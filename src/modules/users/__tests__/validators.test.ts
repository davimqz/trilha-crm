import { describe, expect, it } from "vitest";

import { changeRoleSchema, createUserSchema, resetPasswordSchema, setActiveSchema } from "../validators";

const valid = { name: "Ana Souza", email: "ana@trilha.test", role: "sales", password: "senha-segura-123" };
const USER_ID = "3f2b8c1e-6d4a-4f7b-9c2e-1a5d8e7f6b3c";

describe("createUserSchema", () => {
  it("aceita dados válidos e normaliza nome e e-mail", () => {
    expect(createUserSchema.parse({ ...valid, name: "  Ana Souza ", email: " ANA@Trilha.TEST " })).toEqual(valid);
  });

  it.each([
    ["nome curto", { name: "A" }],
    ["nome longo", { name: "a".repeat(101) }],
    ["e-mail inválido", { email: "ana@" }],
    ["e-mail longo", { email: `${"a".repeat(250)}@t.co` }],
    ["papel inexistente", { role: "root" }],
    ["senha curta (11)", { password: "a".repeat(11) }],
    ["senha longa (129)", { password: "a".repeat(129) }],
  ])("rejeita %s", (_, override) => {
    expect(createUserSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("aceita senha nos limites (12 e 128)", () => {
    expect(createUserSchema.safeParse({ ...valid, password: "a".repeat(12) }).success).toBe(true);
    expect(createUserSchema.safeParse({ ...valid, password: "a".repeat(128) }).success).toBe(true);
  });

  it.each(["id", "active", "emailVerified", "createdAt"])("rejeita campo extra %s (mass assignment)", (field) => {
    expect(createUserSchema.safeParse({ ...valid, [field]: "x" }).success).toBe(false);
  });
});

describe("demais schemas", () => {
  it("exigem userId em formato UUID", () => {
    expect(changeRoleSchema.safeParse({ userId: "1 OR 1=1", role: "admin" }).success).toBe(false);
    expect(setActiveSchema.safeParse({ userId: "../admin", active: false }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ userId: "", password: valid.password }).success).toBe(false);
  });

  it("aceitam entradas válidas", () => {
    expect(changeRoleSchema.safeParse({ userId: USER_ID, role: "viewer" }).success).toBe(true);
    expect(setActiveSchema.safeParse({ userId: USER_ID, active: true }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ userId: USER_ID, password: valid.password }).success).toBe(true);
  });

  it("setActive exige booleano de verdade", () => {
    expect(setActiveSchema.safeParse({ userId: USER_ID, active: "false" }).success).toBe(false);
  });
});
