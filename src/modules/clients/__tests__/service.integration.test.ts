import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { ConflictError, DomainError, NotFoundError } from "@/core/errors";
import { ForbiddenError, type Actor } from "@/core/rbac/authorization";
import type { Role } from "@/core/rbac/roles";
import { leadEvents } from "@/modules/leads/schema";
import { createLeadsService } from "@/modules/leads/service";

import { TEST_PASSWORD, createTestContext, toActor } from "../../../../test/helpers/auth-context";
import { clients } from "../schema";
import { createClientsService } from "../service";

const context = createTestContext();
const { db, usersService } = context;
const leadsService = createLeadsService({ db });
const clientsService = createClientsService({ db });

type Team = Record<Role, Actor> & { sales2: Actor };

async function createTeam(): Promise<Team> {
  const admin = toActor(await usersService.bootstrapAdmin({ name: "Admin", email: "admin@t.test", password: TEST_PASSWORD }));
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
async function createLead(actor: Actor, status = "prospect") {
  seq++;
  return leadsService.createLead(actor, { name: `Pessoa ${seq}`, email: `p${seq}@x.com`, phone: "11912345678", status });
}

async function convert(actor: Actor, leadId: string) {
  await leadsService.moveLead(actor, { leadId, status: "converted" });
  const [client] = await db.select().from(clients).where(eq(clients.leadId, leadId));
  return client;
}

const eventTypes = async (leadId: string) =>
  (await leadsService.listEvents(toActorForRead, { leadId })).map((event) => event.type).reverse();
let toActorForRead: Actor;

describe("clients service", () => {
  let team: Team;

  beforeEach(async () => {
    await context.reset();
    team = await createTeam();
    toActorForRead = team.viewer;
  });
  afterAll(() => context.close());

  describe("ciclo de vida (conversão)", () => {
    it("mover para Convertido cria o cliente Adimplente e registra os eventos", async () => {
      const { id: leadId } = await createLead(team.sales);
      await leadsService.moveLead(team.sales, { leadId, status: "first_contact" });
      const client = await convert(team.sales, leadId);

      expect(client).toMatchObject({ leadId, associativeStatus: "adimplente", archivedAt: null });
      expect(await eventTypes(leadId)).toEqual(["created", "status_changed", "status_changed", "converted"]);
      const [, firstMove] = (await leadsService.listEvents(team.viewer, { leadId })).reverse();
      expect(firstMove).toMatchObject({ fromValue: "prospect", toValue: "first_contact", actorName: "Vendedor" });
    });

    it("sair de Convertido arquiva o cliente; voltar reativa o MESMO cliente", async () => {
      const { id: leadId } = await createLead(team.sales);
      const original = await convert(team.sales, leadId);

      await leadsService.moveLead(team.sales, { leadId, status: "not_converted" });
      const [archived] = await db.select().from(clients).where(eq(clients.leadId, leadId));
      expect(archived.archivedAt).not.toBeNull();
      expect(await clientsService.listClients(team.viewer, {})).toHaveLength(0);
      expect(await clientsService.listClients(team.viewer, { archived: true })).toHaveLength(1);

      const reactivated = await convert(team.sales, leadId);
      expect(reactivated.id).toBe(original.id);
      expect(reactivated.archivedAt).toBeNull();
      expect(await eventTypes(leadId)).toEqual([
        "created",
        "status_changed",
        "converted",
        "status_changed",
        "conversion_reverted",
        "status_changed",
        "client_reactivated",
      ]);
    });

    it("lead cadastrado direto em Convertido também vira cliente", async () => {
      const { id: leadId } = await createLead(team.sales, "converted");
      expect(await db.select().from(clients).where(eq(clients.leadId, leadId))).toHaveLength(1);
      expect(await eventTypes(leadId)).toEqual(["created", "converted"]);
    });

    it("editar o lead mudando o status para Convertido também converte", async () => {
      const { id: leadId } = await createLead(team.sales);
      await leadsService.updateLead(team.sales, { leadId, name: "Pessoa X", email: "px@x.com", phone: "11912345678", status: "converted" });
      expect(await db.select().from(clients).where(eq(clients.leadId, leadId))).toHaveLength(1);
    });

    it("não há como criar cliente manualmente: o service não expõe criação", () => {
      expect(Object.keys(clientsService)).not.toContain("createClient");
    });

    it("excluir lead que virou cliente é bloqueado (mesmo para admin), e nada é apagado", async () => {
      const { id: leadId } = await createLead(team.sales);
      await convert(team.sales, leadId);
      await expect(leadsService.deleteLead(team.admin, { leadId })).rejects.toThrow(DomainError);
      expect(await db.select().from(clients).where(eq(clients.leadId, leadId))).toHaveLength(1);
    });

    it("mover para a mesma coluna não gera evento", async () => {
      const { id: leadId } = await createLead(team.sales);
      await leadsService.moveLead(team.sales, { leadId, status: "prospect" });
      expect(await eventTypes(leadId)).toEqual(["created"]);
    });
  });

  describe("lista e contador", () => {
    it("Clientes Ativos conta só não arquivados e Adimplentes", async () => {
      const a = await convert(team.admin, (await createLead(team.admin)).id);
      await convert(team.admin, (await createLead(team.admin)).id);
      const cLead = await createLead(team.admin);
      await convert(team.admin, cLead.id);
      expect(await clientsService.countActive(team.viewer)).toBe(3);

      const detail = await clientsService.getClient(team.admin, { clientId: a.id });
      await clientsService.updateClient(team.admin, {
        clientId: a.id,
        name: detail.name,
        email: detail.email,
        phone: detail.phone,
        associativeStatus: "inadimplente",
      });
      await leadsService.moveLead(team.admin, { leadId: cLead.id, status: "not_converted" });
      expect(await clientsService.countActive(team.viewer)).toBe(1);
    });

    it("filtra por status associativo, busca por nome e ordena", async () => {
      const first = await convert(team.admin, (await leadsService.createLead(team.admin, { name: "Zélia", email: "z@x.com", phone: "11912345678", status: "prospect" })).id);
      await convert(team.admin, (await leadsService.createLead(team.admin, { name: "Álvaro", email: "a@x.com", phone: "11912345678", status: "prospect" })).id);
      const detail = await clientsService.getClient(team.admin, { clientId: first.id });
      await clientsService.updateClient(team.admin, { clientId: first.id, name: detail.name, email: detail.email, phone: detail.phone, associativeStatus: "inadimplente" });

      expect((await clientsService.listClients(team.viewer, {})).map((client) => client.name)).toEqual(["Álvaro", "Zélia"]);
      expect((await clientsService.listClients(team.viewer, { sort: "name_desc" })).map((client) => client.name)).toEqual(["Zélia", "Álvaro"]);
      expect((await clientsService.listClients(team.viewer, { status: "inadimplente" })).map((client) => client.name)).toEqual(["Zélia"]);
      expect((await clientsService.listClients(team.viewer, { q: "álv" })).map((client) => client.name)).toEqual(["Álvaro"]);
    });
  });

  describe("edição e posse", () => {
    it("edita contato (reflete no lead) e status associativo, com eventos", async () => {
      const { id: leadId } = await createLead(team.sales);
      const client = await convert(team.sales, leadId);

      await clientsService.updateClient(team.sales, {
        clientId: client.id,
        name: "Nome Novo",
        email: "novo@x.com",
        phone: "(21) 98765-4321",
        associativeStatus: "inadimplente",
      });

      const lead = await leadsService.getLead(team.viewer, { leadId });
      expect(lead).toMatchObject({ name: "Nome Novo", email: "novo@x.com", phone: "21987654321" });
      const detail = await clientsService.getClient(team.viewer, { clientId: client.id });
      expect(detail).toMatchObject({ associativeStatus: "inadimplente", updatedByName: "Vendedor", canEdit: false });
      const events = await leadsService.listEvents(team.viewer, { leadId });
      expect(events[0]).toMatchObject({ type: "associative_status_changed", fromValue: "Adimplente", toValue: "Inadimplente" });
      expect(events.map((event) => event.type)).toContain("contact_updated");
    });

    it("sales não edita cliente de outro responsável; viewer não edita nada", async () => {
      const client = await convert(team.sales2, (await createLead(team.sales2)).id);
      const payload = { clientId: client.id, name: "Hack", email: "h@x.com", phone: "11912345678", associativeStatus: "inadimplente" };
      await expect(clientsService.updateClient(team.sales, payload)).rejects.toThrow(ForbiddenError);
      await expect(clientsService.updateClient(team.viewer, payload)).rejects.toThrow(ForbiddenError);
      expect((await clientsService.getClient(team.admin, { clientId: client.id })).associativeStatus).toBe("adimplente");
    });

    it("reatribuir exige clients:assign e registra o evento com os nomes", async () => {
      const client = await convert(team.sales, (await createLead(team.sales)).id);
      const detail = await clientsService.getClient(team.admin, { clientId: client.id });
      const base = { clientId: client.id, name: detail.name, email: detail.email, phone: detail.phone, associativeStatus: "adimplente" };

      await expect(clientsService.updateClient(team.sales, { ...base, ownerId: team.sales2.userId })).rejects.toThrow(ForbiddenError);
      await clientsService.updateClient(team.manager, { ...base, ownerId: team.sales2.userId });
      const [event] = await leadsService.listEvents(team.viewer, { leadId: client.leadId });
      expect(event).toMatchObject({ type: "owner_changed", fromValue: "Vendedor", toValue: "Vendedor Dois" });
    });

    it("e-mail duplicado → ConflictError; campos do servidor → ZodError; cliente inexistente → NotFound", async () => {
      await createLead(team.admin);
      const client = await convert(team.admin, (await createLead(team.admin)).id);
      const base = { clientId: client.id, name: "Nome", phone: "11912345678", associativeStatus: "adimplente" };
      await expect(clientsService.updateClient(team.admin, { ...base, email: `p${seq - 1}@x.com` })).rejects.toThrow(ConflictError);
      await expect(clientsService.updateClient(team.admin, { ...base, email: "ok@x.com", leadId: client.leadId })).rejects.toThrow(ZodError);
      await expect(clientsService.updateClient(team.admin, { ...base, email: "ok@x.com", archivedAt: null })).rejects.toThrow(ZodError);
      await expect(
        clientsService.getClient(team.admin, { clientId: "00000000-0000-4000-8000-000000000000" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("atendimentos", () => {
    const record = (clientId: string, responsibleId: string, overrides: Record<string, unknown> = {}) => ({
      clientId,
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
      type: "meeting",
      subject: "Alinhamento inicial",
      responsibleId,
      description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Pauta", marks: [{ type: "bold" }] }] }] },
      ...overrides,
    });

    it("sales registra atendimento em qualquer cliente; lista do mais recente ao mais antigo", async () => {
      const client = await convert(team.sales2, (await createLead(team.sales2)).id);
      await clientsService.addServiceRecord(team.sales, record(client.id, team.sales.userId, { occurredAt: "2026-01-10T13:00:00-03:00" }));
      await clientsService.addServiceRecord(team.sales, record(client.id, team.sales2.userId, { type: "call", subject: "Retorno", description: null }));

      const list = await clientsService.listServiceRecords(team.viewer, { clientId: client.id });
      expect(list.map((item) => [item.type, item.subject, item.responsibleName])).toEqual([
        ["call", "Retorno", "Vendedor Dois"],
        ["meeting", "Alinhamento inicial", "Vendedor"],
      ]);
      expect(list[1].description).toMatchObject({ type: "doc" });
    });

    it("recusa data no futuro, tipo inválido, assunto curto, responsável inativo, viewer e cliente arquivado", async () => {
      const { id: leadId } = await createLead(team.admin);
      const client = await convert(team.admin, leadId);
      const future = new Date(Date.now() + 60 * 60_000).toISOString();

      await expect(clientsService.addServiceRecord(team.admin, record(client.id, team.admin.userId, { occurredAt: future }))).rejects.toThrow(ZodError);
      await expect(clientsService.addServiceRecord(team.admin, record(client.id, team.admin.userId, { type: "sms" }))).rejects.toThrow(ZodError);
      await expect(clientsService.addServiceRecord(team.admin, record(client.id, team.admin.userId, { subject: "oi" }))).rejects.toThrow(ZodError);
      await expect(clientsService.addServiceRecord(team.viewer, record(client.id, team.viewer.userId))).rejects.toThrow(ForbiddenError);

      await usersService.setActive(team.admin, { userId: team.sales2.userId, active: false });
      await expect(clientsService.addServiceRecord(team.admin, record(client.id, team.sales2.userId))).rejects.toThrow(DomainError);

      await leadsService.moveLead(team.admin, { leadId, status: "not_converted" });
      await expect(clientsService.addServiceRecord(team.admin, record(client.id, team.admin.userId))).rejects.toThrow(DomainError);
    });

    it("XSS: descrição com nós/atributos maliciosos é recusada ou limpa", async () => {
      const client = await convert(team.admin, (await createLead(team.admin)).id);
      await expect(
        clientsService.addServiceRecord(team.admin, record(client.id, team.admin.userId, { description: { type: "doc", content: [{ type: "html", html: "<script>" }] } })),
      ).rejects.toThrow(ZodError);

      await clientsService.addServiceRecord(
        team.admin,
        record(client.id, team.admin.userId, {
          description: { type: "doc", content: [{ type: "paragraph", attrs: { style: "x" }, content: [{ type: "text", text: "ok", onclick: "alert(1)" }] }] },
        }),
      );
      const [stored] = await clientsService.listServiceRecords(team.admin, { clientId: client.id });
      expect(JSON.stringify(stored.description)).not.toMatch(/onclick|style/);
    });

    it("eventos da linha do tempo ficam no lead e somem só junto com ele (cascata)", async () => {
      const { id: leadId } = await createLead(team.admin);
      expect(await db.select().from(leadEvents).where(eq(leadEvents.leadId, leadId))).toHaveLength(1);
      await leadsService.deleteLead(team.admin, { leadId });
      expect(await db.select().from(leadEvents).where(eq(leadEvents.leadId, leadId))).toHaveLength(0);
    });
  });
});
