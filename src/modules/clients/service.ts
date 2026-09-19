import "server-only";

import { and, asc, count, desc, eq, ilike, isNotNull, isNull, sql, type AnyColumn, type SQL } from "drizzle-orm";

import { users } from "@/core/auth/schema";
import { getDb } from "@/core/db";
import type { Database, Transaction } from "@/core/db/create-database";
import { ConflictError, DomainError, NotFoundError, isUniqueViolation } from "@/core/errors";
import { ForbiddenError, type Actor } from "@/core/rbac/authorization";
import { can, requirePermission } from "@/modules/authorization";
import { recordLeadEvents, type LeadEventInput } from "@/modules/leads/events";
import type { RichTextDoc } from "@/modules/leads/rich-text";
import { leads } from "@/modules/leads/schema";

import {
  ASSOCIATIVE_STATUS_LABELS,
  SERVICE_RECORD_TYPE_LABELS,
  type AssociativeStatus,
  type ClientSort,
  type ServiceRecordType,
} from "./constants";
import { clients, clientServiceRecords } from "./schema";
import {
  addServiceRecordSchema,
  clientIdSchema,
  listClientsSchema,
  serviceRecordRefSchema,
  updateClientSchema,
  updateServiceRecordSchema,
} from "./validators";

// ---------- DTOs ----------

export type ClientCapabilities = { canEdit: boolean; canAssign: boolean; canLogService: boolean };

export type ClientRow = {
  id: string;
  leadId: string;
  name: string;
  email: string;
  phone: string;
  ownerId: string;
  ownerName: string;
  associativeStatus: AssociativeStatus;
  convertedAt: Date;
  archivedAt: Date | null;
  updatedAt: Date;
  canEdit: boolean;
};

export type ClientDetail = ClientRow & ClientCapabilities & { updatedByName: string };

export type ServiceRecord = {
  id: string;
  occurredAt: Date;
  type: ServiceRecordType;
  subject: string;
  description: RichTextDoc | null;
  responsibleId: string;
  responsibleName: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date | null;
  updatedByName: string | null;
  // Quem registrou, gestor ou admin podem editar/excluir (revalidado na escrita)
  canManage: boolean;
};

// Nome de usuário por subconsulta (evita aliases de `users` em joins; ver docs/architecture.md)
function userNameOf(column: AnyColumn) {
  return sql<string>`(select ${users.name} from ${users} where ${users.id} = ${column})`;
}

const nameCollated = sql`${leads.name} collate "und-x-icu"`;

function orderFor(sort: ClientSort): SQL[] {
  switch (sort) {
    case "name_desc":
      return [desc(nameCollated)];
    case "converted_desc":
      return [desc(clients.convertedAt)];
    case "converted_asc":
      return [asc(clients.convertedAt)];
    case "updated_desc":
      return [desc(clients.updatedAt)];
    default:
      return [asc(nameCollated)];
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const rowColumns = {
  id: clients.id,
  leadId: clients.leadId,
  name: leads.name,
  email: leads.email,
  phone: leads.phone,
  ownerId: leads.ownerId,
  ownerName: userNameOf(leads.ownerId),
  associativeStatus: clients.associativeStatus,
  convertedAt: clients.convertedAt,
  archivedAt: clients.archivedAt,
  updatedAt: clients.updatedAt,
};

export function canManageServiceRecord(actor: Actor, createdBy: string): boolean {
  return can(actor, "clients:update-any") || (can(actor, "clients:log-service") && createdBy === actor.userId);
}

export function clientCapabilitiesFor(actor: Actor, ownerId: string): ClientCapabilities {
  return {
    canEdit: can(actor, "clients:update-any") || (can(actor, "clients:update") && ownerId === actor.userId),
    canAssign: can(actor, "clients:assign"),
    canLogService: can(actor, "clients:log-service"),
  };
}

export function createClientsService({ db }: { db: Database }) {
  function toRow(actor: Actor, row: Omit<ClientRow, "canEdit" | "associativeStatus"> & { associativeStatus: string }): ClientRow {
    return {
      ...row,
      associativeStatus: row.associativeStatus as AssociativeStatus,
      canEdit: clientCapabilitiesFor(actor, row.ownerId).canEdit,
    };
  }

  // recordId + clientId juntos: impede alterar atendimento de outro cliente trocando só um dos ids
  async function lockServiceRecord(tx: Transaction, clientId: string, recordId: string) {
    const [record] = await tx
      .select({
        createdBy: clientServiceRecords.createdBy,
        type: clientServiceRecords.type,
        subject: clientServiceRecords.subject,
        leadId: clients.leadId,
      })
      .from(clientServiceRecords)
      .innerJoin(clients, eq(clients.id, clientServiceRecords.clientId))
      .where(and(eq(clientServiceRecords.id, recordId), eq(clientServiceRecords.clientId, clientId)))
      .for("update");
    if (!record) throw new NotFoundError("Atendimento não encontrado.");
    return record;
  }

  async function assertClientExists(clientId: string) {
    const [client] = await db.select({ id: clients.id, archivedAt: clients.archivedAt }).from(clients).where(eq(clients.id, clientId));
    if (!client) throw new NotFoundError("Cliente não encontrado.");
    return client;
  }

  return {
    async listClients(actor: Actor, input: unknown): Promise<ClientRow[]> {
      requirePermission(actor, "clients:read");
      const query = listClientsSchema.parse(input ?? {});

      const conditions: SQL[] = [query.archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt)];
      if (query.q) conditions.push(ilike(leads.name, `%${escapeLike(query.q)}%`));
      if (query.status !== "all") conditions.push(eq(clients.associativeStatus, query.status));
      if (query.owner === "me") conditions.push(eq(leads.ownerId, actor.userId));
      else if (query.owner !== "all") conditions.push(eq(leads.ownerId, query.owner));

      const rows = await db
        .select(rowColumns)
        .from(clients)
        .innerJoin(leads, eq(leads.id, clients.leadId))
        .where(and(...conditions))
        .orderBy(...orderFor(query.sort))
        .limit(1000);
      return rows.map((row) => toRow(actor, row));
    },

    // "Clientes Ativos" = não arquivados e Adimplentes (decisão do dono do produto)
    async countActive(actor: Actor): Promise<number> {
      requirePermission(actor, "clients:read");
      const [{ total }] = await db
        .select({ total: count() })
        .from(clients)
        .where(and(isNull(clients.archivedAt), eq(clients.associativeStatus, "adimplente")));
      return total;
    },

    async getClient(actor: Actor, input: unknown): Promise<ClientDetail> {
      requirePermission(actor, "clients:read");
      const { clientId } = clientIdSchema.parse(input);
      const rows = await db
        .select({ ...rowColumns, updatedByName: userNameOf(clients.updatedBy) })
        .from(clients)
        .innerJoin(leads, eq(leads.id, clients.leadId))
        .where(eq(clients.id, clientId));
      const row = rows.at(0);
      if (!row) throw new NotFoundError("Cliente não encontrado.");
      const { updatedByName, ...rest } = row;
      return { ...toRow(actor, rest), ...clientCapabilitiesFor(actor, rest.ownerId), updatedByName };
    },

    async updateClient(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "clients:update");
      const { clientId, ownerId, associativeStatus, ...contact } = updateClientSchema.parse(input);

      try {
        await db.transaction(async (tx) => {
          const [client] = await tx
            .select({ id: clients.id, leadId: clients.leadId, associativeStatus: clients.associativeStatus })
            .from(clients)
            .where(eq(clients.id, clientId))
            .for("update");
          if (!client) throw new NotFoundError("Cliente não encontrado.");

          // Dados de contato e responsável vivem no lead (ADR-008): trava o lead e confere a posse com dados do banco
          const [lead] = await tx
            .select({ ownerId: leads.ownerId, name: leads.name, email: leads.email, phone: leads.phone })
            .from(leads)
            .where(eq(leads.id, client.leadId))
            .for("update");
          if (!lead) throw new NotFoundError("Cliente não encontrado.");
          if (!clientCapabilitiesFor(actor, lead.ownerId).canEdit) {
            throw new ForbiddenError("Você só pode alterar clientes em que é o responsável.");
          }

          const events: LeadEventInput[] = [];
          const leadId = client.leadId;
          let nextOwnerId = lead.ownerId;
          if (ownerId && ownerId !== lead.ownerId) {
            requirePermission(actor, "clients:assign");
            const [target] = await tx
              .select({ name: users.name })
              .from(users)
              .where(and(eq(users.id, ownerId), eq(users.active, true)));
            if (!target) throw new DomainError("Responsável inválido ou inativo.");
            const [previous] = await tx.select({ name: users.name }).from(users).where(eq(users.id, lead.ownerId));
            events.push({ leadId, type: "owner_changed", actorId: actor.userId, fromValue: previous?.name, toValue: target.name });
            nextOwnerId = ownerId;
          }
          if (contact.name !== lead.name || contact.email !== lead.email || contact.phone !== lead.phone) {
            events.push({ leadId, type: "contact_updated", actorId: actor.userId });
          }
          if (associativeStatus !== client.associativeStatus) {
            events.push({
              leadId,
              type: "associative_status_changed",
              actorId: actor.userId,
              fromValue: ASSOCIATIVE_STATUS_LABELS[client.associativeStatus as AssociativeStatus],
              toValue: ASSOCIATIVE_STATUS_LABELS[associativeStatus],
            });
          }

          const now = new Date();
          await tx
            .update(leads)
            .set({ ...contact, ownerId: nextOwnerId, updatedBy: actor.userId, updatedAt: now })
            .where(eq(leads.id, leadId));
          await tx
            .update(clients)
            .set({ associativeStatus, updatedBy: actor.userId, updatedAt: now })
            .where(eq(clients.id, clientId));
          await recordLeadEvents(tx, events);
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError("Já existe um lead/cliente com este e-mail.");
        throw error;
      }
    },

    // ---------- Atendimentos ----------

    async listServiceRecords(actor: Actor, input: unknown): Promise<ServiceRecord[]> {
      requirePermission(actor, "clients:read");
      const { clientId } = clientIdSchema.parse(input);
      await assertClientExists(clientId);
      const rows = await db
        .select({
          id: clientServiceRecords.id,
          occurredAt: clientServiceRecords.occurredAt,
          type: clientServiceRecords.type,
          subject: clientServiceRecords.subject,
          description: clientServiceRecords.description,
          responsibleId: clientServiceRecords.responsibleId,
          responsibleName: userNameOf(clientServiceRecords.responsibleId),
          createdBy: clientServiceRecords.createdBy,
          createdByName: userNameOf(clientServiceRecords.createdBy),
          createdAt: clientServiceRecords.createdAt,
          updatedAt: clientServiceRecords.updatedAt,
          updatedByName: sql<string | null>`(select ${users.name} from ${users} where ${users.id} = ${clientServiceRecords.updatedBy})`,
        })
        .from(clientServiceRecords)
        .where(eq(clientServiceRecords.clientId, clientId))
        .orderBy(desc(clientServiceRecords.occurredAt), desc(clientServiceRecords.createdAt));
      return rows.map(({ createdBy, ...row }) => ({
        ...row,
        type: row.type as ServiceRecordType,
        description: (row.description as RichTextDoc | null) ?? null,
        canManage: canManageServiceRecord(actor, createdBy),
      }));
    },

    async updateServiceRecord(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "clients:log-service");
      const data = updateServiceRecordSchema.parse(input);
      await db.transaction(async (tx) => {
        const record = await lockServiceRecord(tx, data.clientId, data.recordId);
        if (!canManageServiceRecord(actor, record.createdBy)) {
          throw new ForbiddenError("Só quem registrou, gestores e administradores podem editar este atendimento.");
        }
        const [responsible] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, data.responsibleId), eq(users.active, true)));
        if (!responsible) throw new DomainError("Responsável inválido ou inativo.");

        await tx
          .update(clientServiceRecords)
          .set({
            occurredAt: data.occurredAt,
            type: data.type,
            subject: data.subject,
            description: data.description ?? null,
            responsibleId: data.responsibleId,
            updatedAt: new Date(),
            updatedBy: actor.userId,
          })
          .where(eq(clientServiceRecords.id, data.recordId));
        await recordLeadEvents(tx, [
          { leadId: record.leadId, type: "service_record_edited", actorId: actor.userId, toValue: data.subject },
        ]);
      });
    },

    async deleteServiceRecord(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "clients:log-service");
      const { clientId, recordId } = serviceRecordRefSchema.parse(input);
      await db.transaction(async (tx) => {
        const record = await lockServiceRecord(tx, clientId, recordId);
        if (!canManageServiceRecord(actor, record.createdBy)) {
          throw new ForbiddenError("Só quem registrou, gestores e administradores podem excluir este atendimento.");
        }
        await tx.delete(clientServiceRecords).where(eq(clientServiceRecords.id, recordId));
        await recordLeadEvents(tx, [
          {
            leadId: record.leadId,
            type: "service_record_deleted",
            actorId: actor.userId,
            fromValue: `${SERVICE_RECORD_TYPE_LABELS[record.type as ServiceRecordType]} — ${record.subject}`,
          },
        ]);
      });
    },

    async addServiceRecord(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "clients:log-service");
      const data = addServiceRecordSchema.parse(input);

      await db.transaction(async (tx) => {
        const [client] = await tx
          .select({ archivedAt: clients.archivedAt })
          .from(clients)
          .where(eq(clients.id, data.clientId))
          .for("update");
        if (!client) throw new NotFoundError("Cliente não encontrado.");
        if (client.archivedAt) throw new DomainError("Cliente arquivado: reative a conversão para registrar atendimentos.");

        const [responsible] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, data.responsibleId), eq(users.active, true)));
        if (!responsible) throw new DomainError("Responsável inválido ou inativo.");

        await tx.insert(clientServiceRecords).values({
          clientId: data.clientId,
          occurredAt: data.occurredAt,
          type: data.type,
          subject: data.subject,
          // Saída do parse (atributos desconhecidos descartados) é o que vai para o banco
          description: data.description ?? null,
          responsibleId: data.responsibleId,
          createdBy: actor.userId,
        });
      });
    },
  };
}

export type ClientsService = ReturnType<typeof createClientsService>;

export function getClientsService(): ClientsService {
  return createClientsService({ db: getDb() });
}
