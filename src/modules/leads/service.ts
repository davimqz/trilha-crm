import "server-only";

import { and, asc, count, desc, eq, gte, ilike, isNotNull, isNull, sql, type AnyColumn, type SQL } from "drizzle-orm";

import { users } from "@/core/auth/schema";
import { getDb } from "@/core/db";
import type { Database, Transaction } from "@/core/db/create-database";
import { ConflictError, DomainError, NotFoundError, isUniqueViolation } from "@/core/errors";
import { ForbiddenError, type Actor } from "@/core/rbac/authorization";
import { can, requirePermission } from "@/modules/authorization";
import { clients } from "@/modules/clients/schema";
import { syncClientForStatusChange } from "@/modules/clients/sync";

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENTS_PER_LEAD_MAX,
  type LeadEventType,
  type LeadSort,
  type LeadStatus,
} from "./constants";
import { recordLeadEvents, type LeadEventInput } from "./events";
import { ATTACHMENT_KINDS, detectAttachmentKind, sanitizeFileName, type AttachmentKind } from "./file-types";
import type { RichTextDoc } from "./rich-text";
import { leadAttachmentContents, leadAttachments, leadEvents, leadNotes, leads } from "./schema";
import {
  addNoteSchema,
  attachmentRefSchema,
  createLeadSchema,
  leadIdSchema,
  listLeadsSchema,
  moveLeadSchema,
  setArchivedSchema,
  updateLeadSchema,
} from "./validators";

// ---------- DTOs (só o necessário para a UI) ----------

export type LeadCapabilities = { canEdit: boolean; canArchive: boolean; canDelete: boolean; canAssign: boolean };

export type LeadCard = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  ownerId: string;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  archivedByName: string | null;
  canEdit: boolean;
};

export type LeadDetail = LeadCard &
  LeadCapabilities & { createdByName: string; updatedByName: string };

export type LeadNote = { id: string; content: RichTextDoc; authorName: string; createdAt: Date };

export type LeadAttachment = {
  id: string;
  fileName: string;
  kind: AttachmentKind;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: Date;
};

export type AttachmentFile = { fileName: string; kind: AttachmentKind; mimeType: string; data: Buffer };

export type AssignableUser = { id: string; name: string };

export type LeadEvent = {
  id: string;
  type: LeadEventType;
  fromValue: string | null;
  toValue: string | null;
  actorName: string;
  createdAt: Date;
};

const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// Nome do usuário por subconsulta correlacionada. Evita aliases da mesma tabela em joins: no Drizzle 0.45,
// dois aliases de `users` com leftJoin fazem o tipo do resultado virar `never[]` (sem checagem de tipos).
function userNameOf(column: AnyColumn) {
  return sql<string>`(select ${users.name} from ${users} where ${users.id} = ${column})`;
}

const cardColumns = {
  id: leads.id,
  name: leads.name,
  email: leads.email,
  phone: leads.phone,
  status: leads.status,
  ownerId: leads.ownerId,
  ownerName: userNameOf(leads.ownerId),
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  archivedAt: leads.archivedAt,
  archivedByName: sql<string | null>`(select ${users.name} from ${users} where ${users.id} = ${leads.archivedBy})`,
};

// Collation ICU: ordena ignorando maiúsculas/acentos de forma estável em qualquer SO (a imagem Alpine não tem locales)
const nameCollated = sql`${leads.name} collate "und-x-icu"`;

function orderFor(sort: LeadSort): SQL[] {
  switch (sort) {
    case "created_desc":
      return [desc(leads.createdAt)];
    case "created_asc":
      return [asc(leads.createdAt)];
    case "name_asc":
      return [asc(nameCollated), asc(leads.createdAt)];
    case "name_desc":
      return [desc(nameCollated), asc(leads.createdAt)];
    default:
      return [desc(leads.updatedAt)];
  }
}

// `%` e `_` digitados na busca são literais, não curingas
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function isOwnerOrAny(actor: Actor, ownerId: string, own: `leads:${string}`, any: `leads:${string}`): boolean {
  return can(actor, any) || (can(actor, own) && ownerId === actor.userId);
}

export function capabilitiesFor(actor: Actor, ownerId: string): LeadCapabilities {
  return {
    canEdit: isOwnerOrAny(actor, ownerId, "leads:update", "leads:update-any"),
    canArchive: isOwnerOrAny(actor, ownerId, "leads:archive", "leads:archive-any"),
    canDelete: can(actor, "leads:delete"),
    canAssign: can(actor, "leads:assign"),
  };
}

export function createLeadsService({ db }: { db: Database }) {
  // Trava a linha do lead e confere a posse. Retorna o lead travado.
  async function lockLead(tx: Transaction, leadId: string) {
    const [lead] = await tx
      .select({
        id: leads.id,
        ownerId: leads.ownerId,
        archivedAt: leads.archivedAt,
        status: leads.status,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
      })
      .from(leads)
      .where(eq(leads.id, leadId))
      .for("update");
    if (!lead) throw new NotFoundError("Lead não encontrado.");
    return { ...lead, status: lead.status as LeadStatus };
  }

  // Mudança de status sempre gera evento e sincroniza o cliente na mesma transação (ADR-008)
  async function applyStatusChange(tx: Transaction, actor: Actor, leadId: string, from: LeadStatus | null, to: LeadStatus) {
    if (from === to) return;
    if (from !== null) {
      await recordLeadEvents(tx, [{ leadId, type: "status_changed", actorId: actor.userId, fromValue: from, toValue: to }]);
    }
    await syncClientForStatusChange(tx, { leadId, fromStatus: from, toStatus: to, actorId: actor.userId });
  }

  function assertCanEdit(actor: Actor, ownerId: string) {
    if (!capabilitiesFor(actor, ownerId).canEdit) {
      throw new ForbiddenError("Você só pode alterar leads em que é o responsável.");
    }
  }

  async function assertLeadExists(leadId: string) {
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId));
    if (!lead) throw new NotFoundError("Lead não encontrado.");
  }

  function rethrowDuplicateEmail(error: unknown): never {
    if (isUniqueViolation(error)) throw new ConflictError("Já existe um lead com este e-mail.");
    throw error;
  }

  function toCard(actor: Actor, row: Omit<LeadCard, "canEdit" | "status"> & { status: string }): LeadCard {
    return {
      ...row,
      status: row.status as LeadStatus,
      canEdit: capabilitiesFor(actor, row.ownerId).canEdit,
    };
  }

  return {
    async listLeads(actor: Actor, input: unknown): Promise<LeadCard[]> {
      requirePermission(actor, "leads:read");
      const query = listLeadsSchema.parse(input ?? {});

      const conditions: SQL[] = [query.archived ? isNotNull(leads.archivedAt) : isNull(leads.archivedAt)];
      if (query.q) conditions.push(ilike(leads.name, `%${escapeLike(query.q)}%`));
      if (query.owner === "me") conditions.push(eq(leads.ownerId, actor.userId));
      else if (query.owner !== "all") conditions.push(eq(leads.ownerId, query.owner));
      if (query.period !== "any") {
        conditions.push(gte(leads.createdAt, new Date(Date.now() - PERIOD_DAYS[query.period] * DAY_MS)));
      }

      const rows = await db
        .select(cardColumns)
        .from(leads)
        .where(and(...conditions))
        .orderBy(...orderFor(query.sort))
        .limit(1000);

      return rows.map((row) => toCard(actor, row));
    },

    async getLead(actor: Actor, input: unknown): Promise<LeadDetail> {
      requirePermission(actor, "leads:read");
      const { leadId } = leadIdSchema.parse(input);

      const rows = await db
        .select({ ...cardColumns, createdByName: userNameOf(leads.createdBy), updatedByName: userNameOf(leads.updatedBy) })
        .from(leads)
        .where(eq(leads.id, leadId));
      const row = rows.at(0);
      if (!row) throw new NotFoundError("Lead não encontrado.");

      const { createdByName, updatedByName, ...card } = row;
      return { ...toCard(actor, card), ...capabilitiesFor(actor, card.ownerId), createdByName, updatedByName };
    },

    async listAssignableUsers(actor: Actor): Promise<AssignableUser[]> {
      requirePermission(actor, "leads:read");
      return db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name));
    },

    async createLead(actor: Actor, input: unknown): Promise<{ id: string }> {
      requirePermission(actor, "leads:create");
      const data = createLeadSchema.parse(input);
      try {
        return await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(leads)
            .values({ ...data, ownerId: actor.userId, createdBy: actor.userId, updatedBy: actor.userId })
            .returning({ id: leads.id });
          await recordLeadEvents(tx, [{ leadId: created.id, type: "created", actorId: actor.userId, toValue: data.status }]);
          // Cadastrado direto na coluna "Convertido" também vira cliente
          await applyStatusChange(tx, actor, created.id, null, data.status);
          return created;
        });
      } catch (error) {
        rethrowDuplicateEmail(error);
      }
    },

    async updateLead(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "leads:update");
      const { leadId, ownerId, ...data } = updateLeadSchema.parse(input);

      try {
        await db.transaction(async (tx) => {
          const lead = await lockLead(tx, leadId);
          assertCanEdit(actor, lead.ownerId);

          // Mesma regra do kanban (moveLead): lead arquivado não muda de estágio (nem converte/reverte cliente)
          if (lead.archivedAt && data.status !== lead.status) {
            throw new DomainError("Desarquive o lead antes de mudar o status.");
          }

          let nextOwnerId = lead.ownerId;
          const events: LeadEventInput[] = [];
          if (ownerId && ownerId !== lead.ownerId) {
            requirePermission(actor, "leads:assign");
            const [target] = await tx
              .select({ id: users.id, name: users.name })
              .from(users)
              .where(and(eq(users.id, ownerId), eq(users.active, true)));
            if (!target) throw new DomainError("Responsável inválido ou inativo.");
            const [previous] = await tx.select({ name: users.name }).from(users).where(eq(users.id, lead.ownerId));
            events.push({ leadId, type: "owner_changed", actorId: actor.userId, fromValue: previous?.name, toValue: target.name });
            nextOwnerId = ownerId;
          }
          if (data.name !== lead.name || data.email !== lead.email || data.phone !== lead.phone) {
            events.push({ leadId, type: "contact_updated", actorId: actor.userId });
          }

          await tx
            .update(leads)
            .set({ ...data, ownerId: nextOwnerId, updatedBy: actor.userId, updatedAt: new Date() })
            .where(eq(leads.id, leadId));
          await recordLeadEvents(tx, events);
          await applyStatusChange(tx, actor, leadId, lead.status, data.status);
        });
      } catch (error) {
        rethrowDuplicateEmail(error);
      }
    },

    async moveLead(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "leads:update");
      const { leadId, status } = moveLeadSchema.parse(input);

      await db.transaction(async (tx) => {
        const lead = await lockLead(tx, leadId);
        assertCanEdit(actor, lead.ownerId);
        if (lead.archivedAt) throw new DomainError("Desarquive o lead antes de movê-lo.");
        if (lead.status === status) return;
        await tx
          .update(leads)
          .set({ status, updatedBy: actor.userId, updatedAt: new Date() })
          .where(eq(leads.id, leadId));
        await applyStatusChange(tx, actor, leadId, lead.status, status);
      });
    },

    async setArchived(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "leads:archive");
      const { leadId, archived } = setArchivedSchema.parse(input);

      await db.transaction(async (tx) => {
        const lead = await lockLead(tx, leadId);
        if (!capabilitiesFor(actor, lead.ownerId).canArchive) {
          throw new ForbiddenError("Você só pode arquivar leads em que é o responsável.");
        }
        await tx
          .update(leads)
          .set({
            archivedAt: archived ? new Date() : null,
            archivedBy: archived ? actor.userId : null,
            updatedBy: actor.userId,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, leadId));
        if (Boolean(lead.archivedAt) !== archived) {
          await recordLeadEvents(tx, [{ leadId, type: archived ? "archived" : "unarchived", actorId: actor.userId }]);
        }
      });
    },

    async deleteLead(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "leads:delete");
      const { leadId } = leadIdSchema.parse(input);
      await db.transaction(async (tx) => {
        await lockLead(tx, leadId);
        // Lead que virou cliente não pode ser excluído (apagaria o cliente e o histórico) — ADR-008
        const [client] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.leadId, leadId));
        if (client) {
          throw new DomainError("Este lead já virou cliente e não pode ser excluído. Arquive-o se não quiser vê-lo no kanban.");
        }
        // Anotações, anexos, conteúdos e eventos saem em cascata (FK ON DELETE CASCADE)
        await tx.delete(leads).where(eq(leads.id, leadId));
      });
    },

    // ---------- Linha do tempo (eventos próprios; notas/anexos/atendimentos vêm das próprias tabelas) ----------

    async listEvents(actor: Actor, input: unknown): Promise<LeadEvent[]> {
      requirePermission(actor, "leads:read");
      const { leadId } = leadIdSchema.parse(input);
      await assertLeadExists(leadId);
      const rows = await db
        .select({
          id: leadEvents.id,
          type: leadEvents.type,
          fromValue: leadEvents.fromValue,
          toValue: leadEvents.toValue,
          actorName: users.name,
          createdAt: leadEvents.createdAt,
        })
        .from(leadEvents)
        .innerJoin(users, eq(users.id, leadEvents.actorId))
        .where(eq(leadEvents.leadId, leadId))
        .orderBy(desc(leadEvents.createdAt));
      return rows.map((row) => ({ ...row, type: row.type as LeadEventType }));
    },

    // ---------- Anotações ----------

    async listNotes(actor: Actor, input: unknown): Promise<LeadNote[]> {
      requirePermission(actor, "leads:read");
      const { leadId } = leadIdSchema.parse(input);
      await assertLeadExists(leadId);

      const rows = await db
        .select({ id: leadNotes.id, content: leadNotes.content, authorName: users.name, createdAt: leadNotes.createdAt })
        .from(leadNotes)
        .innerJoin(users, eq(users.id, leadNotes.authorId))
        .where(eq(leadNotes.leadId, leadId))
        .orderBy(desc(leadNotes.createdAt));
      return rows.map((row) => ({ ...row, content: row.content as RichTextDoc }));
    },

    async addNote(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "leads:update");
      // A saída do parse (com atributos desconhecidos descartados) é o que vai para o banco
      const { leadId, content } = addNoteSchema.parse(input);

      await db.transaction(async (tx) => {
        const lead = await lockLead(tx, leadId);
        assertCanEdit(actor, lead.ownerId);
        await tx.insert(leadNotes).values({ leadId, authorId: actor.userId, content });
      });
    },

    // ---------- Anexos ----------

    async listAttachments(actor: Actor, input: unknown): Promise<LeadAttachment[]> {
      requirePermission(actor, "leads:read");
      const { leadId } = leadIdSchema.parse(input);
      await assertLeadExists(leadId);

      const rows = await db
        .select({
          id: leadAttachments.id,
          fileName: leadAttachments.fileName,
          kind: leadAttachments.kind,
          sizeBytes: leadAttachments.sizeBytes,
          uploadedByName: users.name,
          createdAt: leadAttachments.createdAt,
        })
        .from(leadAttachments)
        .innerJoin(users, eq(users.id, leadAttachments.uploadedBy))
        .where(eq(leadAttachments.leadId, leadId))
        .orderBy(desc(leadAttachments.createdAt));
      return rows.map((row) => ({ ...row, kind: row.kind as AttachmentKind }));
    },

    async addAttachment(
      actor: Actor,
      input: { leadId: unknown; fileName: string; data: Uint8Array },
    ): Promise<LeadAttachment> {
      requirePermission(actor, "leads:update");
      const { leadId } = leadIdSchema.parse({ leadId: input.leadId });

      if (input.data.byteLength === 0) throw new DomainError("O arquivo está vazio.");
      if (input.data.byteLength > ATTACHMENT_MAX_BYTES) throw new DomainError("O arquivo passa do limite de 10 MB.");

      const fileName = sanitizeFileName(input.fileName);
      const kind = detectAttachmentKind(fileName, input.data);
      if (!kind) {
        throw new DomainError("Tipo de arquivo não permitido. Use PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, TXT ou CSV.");
      }

      return db.transaction(async (tx) => {
        const lead = await lockLead(tx, leadId);
        assertCanEdit(actor, lead.ownerId);

        const [{ total }] = await tx
          .select({ total: count() })
          .from(leadAttachments)
          .where(eq(leadAttachments.leadId, leadId));
        if (total >= ATTACHMENTS_PER_LEAD_MAX) {
          throw new DomainError(`Este lead já tem ${ATTACHMENTS_PER_LEAD_MAX} anexos (limite).`);
        }

        const [created] = await tx
          .insert(leadAttachments)
          .values({
            leadId,
            fileName,
            kind,
            mimeType: ATTACHMENT_KINDS[kind].mimeType,
            sizeBytes: input.data.byteLength,
            uploadedBy: actor.userId,
          })
          .returning({ id: leadAttachments.id, createdAt: leadAttachments.createdAt });
        await tx
          .insert(leadAttachmentContents)
          .values({ attachmentId: created.id, data: Buffer.from(input.data) });

        return { id: created.id, fileName, kind, sizeBytes: input.data.byteLength, uploadedByName: actor.name, createdAt: created.createdAt };
      });
    },

    async getAttachmentFile(actor: Actor, input: unknown): Promise<AttachmentFile> {
      requirePermission(actor, "leads:read");
      const { leadId, attachmentId } = attachmentRefSchema.parse(input);

      // leadId + attachmentId juntos: impede baixar anexo de outro lead trocando só um dos ids
      const [row] = await db
        .select({
          fileName: leadAttachments.fileName,
          kind: leadAttachments.kind,
          mimeType: leadAttachments.mimeType,
          data: leadAttachmentContents.data,
        })
        .from(leadAttachments)
        .innerJoin(leadAttachmentContents, eq(leadAttachmentContents.attachmentId, leadAttachments.id))
        .where(and(eq(leadAttachments.id, attachmentId), eq(leadAttachments.leadId, leadId)));
      if (!row) throw new NotFoundError("Anexo não encontrado.");
      return { ...row, kind: row.kind as AttachmentKind };
    },

    async removeAttachment(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "leads:update");
      const { leadId, attachmentId } = attachmentRefSchema.parse(input);

      await db.transaction(async (tx) => {
        const lead = await lockLead(tx, leadId);
        assertCanEdit(actor, lead.ownerId);
        const deleted = await tx
          .delete(leadAttachments)
          .where(and(eq(leadAttachments.id, attachmentId), eq(leadAttachments.leadId, leadId)))
          .returning({ id: leadAttachments.id });
        if (deleted.length === 0) throw new NotFoundError("Anexo não encontrado.");
      });
    },
  };
}

export type LeadsService = ReturnType<typeof createLeadsService>;

export function getLeadsService(): LeadsService {
  return createLeadsService({ db: getDb() });
}
