import { describe, expect, it } from "vitest";

import { createLeadSchema, listLeadsSchema, moveLeadSchema, updateLeadSchema } from "../validators";

const contact = { name: "Ana Souza", email: "ana@exemplo.com", phone: "(11) 91234-5678" };
const valid = { ...contact, status: "prospect" };
const LEAD_ID = "3f2b8c1e-6d4a-4f7b-9c2e-1a5d8e7f6b3c";

describe("createLeadSchema", () => {
  it("normaliza nome, e-mail e telefone", () => {
    expect(createLeadSchema.parse({ ...valid, name: " Ana Souza ", email: " ANA@Exemplo.com " })).toEqual({
      ...valid,
      phone: "11912345678",
      birthDate: null,
    });
  });

  it("data de nascimento opcional: vazia ou ausente vira null; válida passa", () => {
    expect(createLeadSchema.parse({ ...valid, birthDate: "" }).birthDate).toBeNull();
    expect(createLeadSchema.parse(valid).birthDate).toBeNull();
    expect(createLeadSchema.parse({ ...valid, birthDate: "1990-05-20" }).birthDate).toBe("1990-05-20");
    expect(createLeadSchema.parse({ ...valid, birthDate: "2000-02-29" }).birthDate).toBe("2000-02-29");
  });

  it.each([
    ["formato brasileiro", "20/05/1990"],
    ["dia inexistente", "2026-02-30"],
    ["ano não bissexto", "2023-02-29"],
    ["antes de 1900", "1899-12-31"],
    ["no futuro", "2999-01-01"],
    ["texto qualquer", "<script>"],
  ])("rejeita data de nascimento: %s", (_, birthDate) => {
    expect(createLeadSchema.safeParse({ ...valid, birthDate }).success).toBe(false);
  });

  it.each([
    ["nome curto", { name: "A" }],
    ["nome longo", { name: "a".repeat(121) }],
    ["e-mail inválido", { email: "ana@" }],
    ["telefone sem DDD", { phone: "91234-5678" }],
    ["status inexistente", { status: "won" }],
    ["estágio fora de Prospect/Primeiro Contato", { status: "meeting_scheduled" }],
    ["cadastro direto em Convertido", { status: "converted" }],
  ])("rejeita %s", (_, override) => {
    expect(createLeadSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it.each(["ownerId", "archivedAt", "createdBy", "id"])("rejeita campo controlado pelo servidor: %s", (field) => {
    expect(createLeadSchema.safeParse({ ...valid, [field]: LEAD_ID }).success).toBe(false);
  });
});

describe("updateLeadSchema / moveLeadSchema", () => {
  it("aceita Primeiro Contato no cadastro", () => {
    expect(createLeadSchema.safeParse({ ...valid, status: "first_contact" }).success).toBe(true);
  });

  it("aceita ownerId opcional e exige leadId UUID", () => {
    expect(updateLeadSchema.safeParse({ ...contact, leadId: LEAD_ID }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ ...contact, leadId: LEAD_ID, ownerId: LEAD_ID }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ ...contact, leadId: "1 or 1=1" }).success).toBe(false);
    // Status não se edita no formulário: só pelo kanban (moveLead)
    expect(updateLeadSchema.safeParse({ ...valid, leadId: LEAD_ID }).success).toBe(false);
    expect(moveLeadSchema.safeParse({ leadId: LEAD_ID, status: "hacked" }).success).toBe(false);
  });
});

describe("listLeadsSchema", () => {
  it("usa padrões para parâmetros ausentes ou inválidos da URL", () => {
    expect(listLeadsSchema.parse({})).toEqual({
      q: "",
      owner: "all",
      period: "any",
      sort: "updated_desc",
      archived: false,
    });
    expect(listLeadsSchema.parse({ owner: "'; drop table", period: "1y", sort: "x", q: "a".repeat(500) })).toEqual({
      q: "",
      owner: "all",
      period: "any",
      sort: "updated_desc",
      archived: false,
    });
  });
});
