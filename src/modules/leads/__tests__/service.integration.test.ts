import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { ConflictError, DomainError, NotFoundError } from "@/core/errors";
import { ForbiddenError, type Actor } from "@/core/rbac/authorization";
import type { Role } from "@/core/rbac/roles";

import { TEST_PASSWORD, createTestContext, toActor } from "../../../../test/helpers/auth-context";
import { leadAttachmentContents, leadAttachments, leadNotes, leads } from "../schema";
import { createLeadsService } from "../service";

const context = createTestContext();
const { db, usersService } = context;
const service = createLeadsService({ db });

const PDF = new TextEncoder().encode("%PDF-1.7\nconteudo");
const noteDoc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

type Team = Record<Role, Actor> & { sales2: Actor };

async function createTeam(): Promise<Team> {
  const admin = toActor(
    await usersService.bootstrapAdmin({ name: "Admin", email: "admin@t.test", password: TEST_PASSWORD }),
  );
  const make = async (role: Role, email: string, name: string) =>
    toActor(await usersService.createUser(admin, { name, email, role, password: TEST_PASSWORD }));
  return {
    admin,
    manager: await make("manager", "manager@t.test", "Gestor"),
    sales: await make("sales", "sales@t.test", "Vendedor"),
    sales2: await make("sales", "sales2@t.test", "Vendedor Dois"),
    viewer: await make("viewer", "viewer@t.test", "Leitor"),
  };
}

let seq = 0;
async function createLeadAs(actor: Actor, overrides: Record<string, unknown> = {}) {
  seq++;
  return service.createLead(actor, {
    name: `Lead ${seq}`,
    email: `lead${seq}@exemplo.com`,
    phone: "(11) 91234-5678",
    status: "prospect",
    ...overrides,
  });
}

describe("leads service", () => {
  let team: Team;

  beforeEach(async () => {
    await context.reset();
    team = await createTeam();
  });
  afterAll(() => context.close());

  describe("cadastro e leitura", () => {
    it("cria com o ator como responsável e normaliza os dados", async () => {
      const { id } = await createLeadAs(team.sales, { name: "  Ana  ", email: " ANA@X.com ", phone: "+55 81 99876-5432" });
      const lead = await service.getLead(team.viewer, { leadId: id });

      expect(lead).toMatchObject({
        name: "Ana",
        email: "ana@x.com",
        phone: "81998765432",
        status: "prospect",
        ownerId: team.sales.userId,
        ownerName: "Vendedor",
        createdByName: "Vendedor",
        updatedByName: "Vendedor",
        archivedAt: null,
      });
      // viewer lê, mas não tem nenhuma capacidade de alteração
      expect(lead).toMatchObject({ canEdit: false, canArchive: false, canDelete: false, canAssign: false });
    });

    it("recusa e-mail duplicado sem diferenciar maiúsculas", async () => {
      await createLeadAs(team.sales, { email: "dup@x.com" });
      await expect(createLeadAs(team.manager, { email: "DUP@x.com" })).rejects.toThrow(ConflictError);
    });

    it("recusa campos controlados pelo servidor (mass assignment)", async () => {
      await expect(createLeadAs(team.sales, { ownerId: team.admin.userId })).rejects.toThrow(ZodError);
      await expect(createLeadAs(team.sales, { archivedAt: new Date().toISOString() })).rejects.toThrow(ZodError);
    });

    it("viewer não cadastra", async () => {
      await expect(createLeadAs(team.viewer)).rejects.toThrow(ForbiddenError);
    });

    it("lead inexistente → NotFound", async () => {
      await expect(service.getLead(team.admin, { leadId: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("listagem: busca, filtros e ordenação", () => {
    it("busca por parte do nome, sem diferenciar maiúsculas", async () => {
      await createLeadAs(team.sales, { name: "Mariana Costa" });
      await createLeadAs(team.sales, { name: "João Mariano" });
      await createLeadAs(team.sales, { name: "Pedro" });
      const names = (await service.listLeads(team.viewer, { q: "MARIAN" })).map((lead) => lead.name).sort();
      expect(names).toEqual(["João Mariano", "Mariana Costa"]);
    });

    it("trata % e _ como texto literal", async () => {
      await createLeadAs(team.sales, { name: "Cem por cento 100%" });
      await createLeadAs(team.sales, { name: "Outro lead" });
      expect((await service.listLeads(team.viewer, { q: "%" })).map((lead) => lead.name)).toEqual(["Cem por cento 100%"]);
      expect(await service.listLeads(team.viewer, { q: "_" })).toHaveLength(0);
    });

    it("filtra por responsável (meus / usuário) e período", async () => {
      await createLeadAs(team.sales, { name: "Do vendedor" });
      const { id: oldId } = await createLeadAs(team.manager, { name: "Do gestor antigo" });
      await db.update(leads).set({ createdAt: new Date(Date.now() - 40 * 86_400_000) }).where(eq(leads.id, oldId));

      expect((await service.listLeads(team.sales, { owner: "me" })).map((lead) => lead.name)).toEqual(["Do vendedor"]);
      expect((await service.listLeads(team.admin, { owner: team.manager.userId })).map((lead) => lead.name)).toEqual([
        "Do gestor antigo",
      ]);
      expect((await service.listLeads(team.admin, { period: "30d" })).map((lead) => lead.name)).toEqual(["Do vendedor"]);
      expect(await service.listLeads(team.admin, { period: "90d" })).toHaveLength(2);
    });

    it("ordena por nome (ignorando maiúsculas e acentos) e por criação", async () => {
      await createLeadAs(team.sales, { name: "Bruno" });
      await createLeadAs(team.sales, { name: "alice" });
      await createLeadAs(team.sales, { name: "Carla" });
      await createLeadAs(team.sales, { name: "Álvaro" });
      expect((await service.listLeads(team.admin, { sort: "name_asc" })).map((lead) => lead.name)).toEqual([
        "alice",
        "Álvaro",
        "Bruno",
        "Carla",
      ]);
      expect((await service.listLeads(team.admin, { sort: "name_desc" })).map((lead) => lead.name)).toEqual([
        "Carla",
        "Bruno",
        "Álvaro",
        "alice",
      ]);
      expect((await service.listLeads(team.admin, { sort: "created_asc" })).map((lead) => lead.name)).toEqual([
        "Bruno",
        "alice",
        "Carla",
        "Álvaro",
      ]);
    });

    it("canEdit no card reflete a posse para o sales", async () => {
      await createLeadAs(team.sales, { name: "Meu" });
      await createLeadAs(team.sales2, { name: "Do colega" });
      const cards = await service.listLeads(team.sales, { sort: "name_asc" });
      expect(cards.map((card) => [card.name, card.canEdit])).toEqual([
        ["Do colega", false],
        ["Meu", true],
      ]);
    });
  });

  describe("edição e posse (ADR-003)", () => {
    it("sales edita e move o próprio lead; 'última edição' registra autor e horário", async () => {
      const { id } = await createLeadAs(team.sales);
      const before = await service.getLead(team.sales, { leadId: id });

      await service.updateLead(team.sales, {
        leadId: id,
        name: "Nome Novo",
        email: "novo@x.com",
        phone: "(21) 3123-4567",
        status: "first_contact",
      });
      await service.moveLead(team.sales, { leadId: id, status: "meeting_scheduled" });

      const after = await service.getLead(team.sales, { leadId: id });
      expect(after).toMatchObject({ name: "Nome Novo", phone: "2131234567", status: "meeting_scheduled" });
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    });

    it("sales NÃO altera lead de outro responsável (IDOR)", async () => {
      const { id } = await createLeadAs(team.sales2);
      const attempts = [
        service.moveLead(team.sales, { leadId: id, status: "converted" }),
        service.updateLead(team.sales, { leadId: id, name: "X Y", email: "x@x.com", phone: "11912345678", status: "prospect" }),
        service.setArchived(team.sales, { leadId: id, archived: true }),
        service.addNote(team.sales, { leadId: id, content: noteDoc("invasão") }),
        service.addAttachment(team.sales, { leadId: id, fileName: "a.pdf", data: PDF }),
      ];
      // allSettled: todas as promises ganham handler de imediato (nada de rejeição não tratada)
      const results = await Promise.allSettled(attempts);
      for (const result of results) {
        expect(result.status).toBe("rejected");
        expect((result as PromiseRejectedResult).reason).toBeInstanceOf(ForbiddenError);
      }

      const lead = await service.getLead(team.admin, { leadId: id });
      expect(lead).toMatchObject({ status: "prospect", archivedAt: null });
    });

    it("manager e admin alteram qualquer lead", async () => {
      const { id } = await createLeadAs(team.sales);
      await service.moveLead(team.manager, { leadId: id, status: "meeting_done" });
      await service.moveLead(team.admin, { leadId: id, status: "converted" });
      expect((await service.getLead(team.viewer, { leadId: id })).updatedByName).toBe("Admin");
    });

    it("reatribuição exige leads:assign e responsável ativo", async () => {
      const { id } = await createLeadAs(team.sales);
      const base = { leadId: id, name: "Lead", email: "l@x.com", phone: "11912345678", status: "prospect" };

      await expect(service.updateLead(team.sales, { ...base, ownerId: team.sales2.userId })).rejects.toThrow(ForbiddenError);

      await usersService.setActive(team.admin, { userId: team.sales2.userId, active: false });
      await expect(service.updateLead(team.manager, { ...base, ownerId: team.sales2.userId })).rejects.toThrow(DomainError);

      await service.updateLead(team.manager, { ...base, ownerId: team.viewer.userId });
      expect((await service.getLead(team.admin, { leadId: id })).ownerName).toBe("Leitor");
    });

    it("viewer não altera nada", async () => {
      const { id } = await createLeadAs(team.sales);
      await expect(service.moveLead(team.viewer, { leadId: id, status: "converted" })).rejects.toThrow(ForbiddenError);
      await expect(service.setArchived(team.viewer, { leadId: id, archived: true })).rejects.toThrow(ForbiddenError);
      await expect(service.deleteLead(team.viewer, { leadId: id })).rejects.toThrow(ForbiddenError);
    });
  });

  describe("arquivar e excluir", () => {
    it("arquivar tira do kanban e leva para arquivados; desarquivar volta", async () => {
      const { id } = await createLeadAs(team.sales);
      await service.setArchived(team.sales, { leadId: id, archived: true });

      expect(await service.listLeads(team.sales, {})).toHaveLength(0);
      const archived = await service.listLeads(team.sales, { archived: true });
      expect(archived).toMatchObject([{ id, archivedByName: "Vendedor" }]);
      await expect(service.moveLead(team.sales, { leadId: id, status: "converted" })).rejects.toThrow(DomainError);

      await service.setArchived(team.sales, { leadId: id, archived: false });
      expect(await service.listLeads(team.sales, {})).toHaveLength(1);
    });

    it("só manager/admin excluem, e a exclusão apaga anotações e anexos", async () => {
      const { id } = await createLeadAs(team.sales);
      await service.addNote(team.sales, { leadId: id, content: noteDoc("nota") });
      await service.addAttachment(team.sales, { leadId: id, fileName: "p.pdf", data: PDF });

      await expect(service.deleteLead(team.sales, { leadId: id })).rejects.toThrow(ForbiddenError);
      await service.deleteLead(team.manager, { leadId: id });

      expect(await db.select().from(leads)).toHaveLength(0);
      expect(await db.select().from(leadNotes)).toHaveLength(0);
      expect(await db.select().from(leadAttachments)).toHaveLength(0);
      expect(await db.select().from(leadAttachmentContents)).toHaveLength(0);
    });
  });

  describe("anotações", () => {
    it("guarda a formatação permitida e lista da mais recente para a mais antiga", async () => {
      const { id } = await createLeadAs(team.sales);
      const formatted = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Importante", marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: "#dc2626" } }] }],
          },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] }] },
        ],
      };
      await service.addNote(team.sales, { leadId: id, content: noteDoc("primeira") });
      await service.addNote(team.sales, { leadId: id, content: formatted });

      const notes = await service.listNotes(team.viewer, { leadId: id });
      expect(notes).toHaveLength(2);
      expect(notes[0].content).toEqual(formatted);
      expect(notes[0].authorName).toBe("Vendedor");
    });

    it("XSS: descarta atributos/HTML injetados e recusa nós desconhecidos", async () => {
      const { id } = await createLeadAs(team.sales);
      await service.addNote(team.sales, {
        leadId: id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              attrs: { style: "x" },
              content: [{ type: "text", text: "<img src=x onerror=alert(1)>", onclick: "alert(1)", marks: [{ type: "textStyle", attrs: { color: "red;background:url(//evil)" } }] }],
            },
          ],
        },
      });
      const [stored] = await db.select({ content: leadNotes.content }).from(leadNotes);
      const json = JSON.stringify(stored.content);
      expect(json).not.toMatch(/onclick|style|evil/);
      // O texto é guardado como texto (React escapa na renderização)
      expect(json).toContain("<img src=x onerror=alert(1)>");

      await expect(
        service.addNote(team.sales, { leadId: id, content: { type: "doc", content: [{ type: "html", html: "<script>" }] } }),
      ).rejects.toThrow(ZodError);
    });
  });

  describe("editar e excluir anotações", () => {
    async function noteOf(actor: Actor, leadId: string, text: string) {
      await service.addNote(actor, { leadId, content: noteDoc(text) });
      const [note] = await service.listNotes(actor, { leadId });
      return note;
    }

    it("autor edita e exclui a própria anotação; eventos ficam na linha do tempo", async () => {
      const { id: leadId } = await createLeadAs(team.sales);
      const note = await noteOf(team.sales, leadId, "texto original");
      expect(note.canManage).toBe(true);

      await service.updateNote(team.sales, { leadId, noteId: note.id, content: noteDoc("texto corrigido") });
      const [edited] = await service.listNotes(team.viewer, { leadId });
      expect(edited).toMatchObject({ updatedByName: "Vendedor", canManage: false });
      expect(JSON.stringify(edited.content)).toContain("texto corrigido");

      await service.deleteNote(team.sales, { leadId, noteId: note.id });
      expect(await service.listNotes(team.viewer, { leadId })).toHaveLength(0);
      const events = await service.listEvents(team.viewer, { leadId });
      expect(events[0]).toMatchObject({ type: "note_deleted", fromValue: "texto corrigido", actorName: "Vendedor" });
      expect(events[1]).toMatchObject({ type: "note_edited" });
    });

    it("outro comercial e viewer não editam nem excluem; gestor pode", async () => {
      const { id: leadId } = await createLeadAs(team.sales);
      const note = await noteOf(team.sales, leadId, "nota do vendedor");

      await expect(service.updateNote(team.sales2, { leadId, noteId: note.id, content: noteDoc("x") })).rejects.toThrow(ForbiddenError);
      await expect(service.deleteNote(team.sales2, { leadId, noteId: note.id })).rejects.toThrow(ForbiddenError);
      await expect(service.deleteNote(team.viewer, { leadId, noteId: note.id })).rejects.toThrow(ForbiddenError);

      await service.updateNote(team.manager, { leadId, noteId: note.id, content: noteDoc("ajustada pelo gestor") });
      await service.deleteNote(team.manager, { leadId, noteId: note.id });
      expect(await service.listNotes(team.admin, { leadId })).toHaveLength(0);
    });

    it("IDOR: não altera anotação usando o id de outro lead; conteúdo malicioso é recusado", async () => {
      const { id: leadA } = await createLeadAs(team.sales);
      const { id: leadB } = await createLeadAs(team.sales);
      const note = await noteOf(team.sales, leadA, "nota A");

      await expect(service.updateNote(team.sales, { leadId: leadB, noteId: note.id, content: noteDoc("x") })).rejects.toThrow(NotFoundError);
      await expect(service.deleteNote(team.sales, { leadId: leadB, noteId: note.id })).rejects.toThrow(NotFoundError);
      await expect(
        service.updateNote(team.sales, { leadId: leadA, noteId: note.id, content: { type: "doc", content: [{ type: "html" }] } }),
      ).rejects.toThrow(ZodError);
      await expect(
        service.updateNote(team.sales, { leadId: leadA, noteId: note.id, content: noteDoc("x"), authorId: team.admin.userId }),
      ).rejects.toThrow(ZodError);
    });
  });

  describe("anexos", () => {
    it("anexa, lista, baixa e remove", async () => {
      const { id } = await createLeadAs(team.sales);
      const attachment = await service.addAttachment(team.sales, { leadId: id, fileName: "../../Proposta.pdf", data: PDF });
      expect(attachment).toMatchObject({ fileName: "Proposta.pdf", kind: "pdf", sizeBytes: PDF.byteLength });

      const list = await service.listAttachments(team.viewer, { leadId: id });
      expect(list).toMatchObject([{ fileName: "Proposta.pdf", kind: "pdf", uploadedByName: "Vendedor" }]);

      const file = await service.getAttachmentFile(team.viewer, { leadId: id, attachmentId: attachment.id });
      expect(file.mimeType).toBe("application/pdf");
      expect(Buffer.compare(file.data, Buffer.from(PDF))).toBe(0);

      await service.removeAttachment(team.sales, { leadId: id, attachmentId: attachment.id });
      expect(await service.listAttachments(team.viewer, { leadId: id })).toHaveLength(0);
    });

    it("recusa tipo falso, arquivo vazio, acima de 10 MB e acima de 20 por lead", async () => {
      const { id } = await createLeadAs(team.sales);
      const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
      await expect(service.addAttachment(team.sales, { leadId: id, fileName: "x.pdf", data: html })).rejects.toThrow(/não permitido/);
      await expect(service.addAttachment(team.sales, { leadId: id, fileName: "x.html", data: html })).rejects.toThrow(/não permitido/);
      await expect(service.addAttachment(team.sales, { leadId: id, fileName: "x.pdf", data: new Uint8Array() })).rejects.toThrow(/vazio/);

      const big = new Uint8Array(10 * 1024 * 1024 + 1);
      big.set(PDF);
      await expect(service.addAttachment(team.sales, { leadId: id, fileName: "x.pdf", data: big })).rejects.toThrow(/10 MB/);

      for (let index = 0; index < 20; index++) {
        await service.addAttachment(team.sales, { leadId: id, fileName: `a${index}.pdf`, data: PDF });
      }
      await expect(service.addAttachment(team.sales, { leadId: id, fileName: "extra.pdf", data: PDF })).rejects.toThrow(/limite/);
    });

    it("IDOR: não baixa nem remove anexo usando o id de outro lead", async () => {
      const { id: leadA } = await createLeadAs(team.sales);
      const { id: leadB } = await createLeadAs(team.sales);
      const attachment = await service.addAttachment(team.sales, { leadId: leadA, fileName: "a.pdf", data: PDF });

      await expect(service.getAttachmentFile(team.sales, { leadId: leadB, attachmentId: attachment.id })).rejects.toThrow(NotFoundError);
      await expect(service.removeAttachment(team.sales, { leadId: leadB, attachmentId: attachment.id })).rejects.toThrow(NotFoundError);

      const { id: otherLead } = await createLeadAs(team.sales2);
      const foreign = await service.addAttachment(team.sales2, { leadId: otherLead, fileName: "b.pdf", data: PDF });
      await expect(service.removeAttachment(team.sales, { leadId: otherLead, attachmentId: foreign.id })).rejects.toThrow(ForbiddenError);
    });

    it("listagens nunca trazem o conteúdo binário", async () => {
      const { id } = await createLeadAs(team.sales);
      await service.addAttachment(team.sales, { leadId: id, fileName: "a.pdf", data: PDF });
      const [item] = await service.listAttachments(team.sales, { leadId: id });
      expect(item).not.toHaveProperty("data");
      const [{ total }] = await db.execute<{ total: number }>(sql`select count(*)::int as total from lead_attachment_contents`);
      expect(total).toBe(1);
    });
  });
});
