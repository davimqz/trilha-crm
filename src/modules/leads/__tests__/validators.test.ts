import { describe, expect, it } from "vitest";

import { createLeadSchema, listLeadsSchema, moveLeadSchema, updateLeadSchema } from "../validators";

const valid = { name: "Ana Souza", email: "ana@exemplo.com", phone: "(11) 91234-5678", status: "prospect" };
const LEAD_ID = "3f2b8c1e-6d4a-4f7b-9c2e-1a5d8e7f6b3c";

describe("createLeadSchema", () => {
  it("normaliza nome, e-mail e telefone", () => {
    expect(createLeadSchema.parse({ ...valid, name: " Ana Souza ", email: " ANA@Exemplo.com " })).toEqual({
      ...valid,
      phone: "11912345678",
    });
  });

  it.each([
    ["nome curto", { name: "A" }],
    ["nome longo", { name: "a".repeat(121) }],
    ["e-mail inválido", { email: "ana@" }],
    ["telefone sem DDD", { phone: "91234-5678" }],
    ["status inexistente", { status: "won" }],
  ])("rejeita %s", (_, override) => {
    expect(createLeadSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it.each(["ownerId", "archivedAt", "createdBy", "id"])("rejeita campo controlado pelo servidor: %s", (field) => {
    expect(createLeadSchema.safeParse({ ...valid, [field]: LEAD_ID }).success).toBe(false);
  });
});

describe("updateLeadSchema / moveLeadSchema", () => {
  it("aceita ownerId opcional e exige leadId UUID", () => {
    expect(updateLeadSchema.safeParse({ ...valid, leadId: LEAD_ID }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ ...valid, leadId: LEAD_ID, ownerId: LEAD_ID }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ ...valid, leadId: "1 or 1=1" }).success).toBe(false);
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
