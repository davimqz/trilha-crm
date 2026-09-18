import { describe, expect, it } from "vitest";

import { defineModule } from "@/core/modules/types";

import { createAuthorization, ForbiddenError } from "./authorization";
import { ROLES, type Role } from "./roles";

const notes = defineModule({
  id: "notes",
  name: "Notas",
  permissions: {
    read: { description: "Ver", roles: ["admin", "manager", "sales", "viewer"] },
    create: { description: "Criar", roles: ["admin", "manager", "sales"] },
    delete: { description: "Excluir", roles: ["admin", "manager"] },
    manage: { description: "Gerenciar", roles: ["admin"] },
  },
});

const { can, requirePermission } = createAuthorization([notes]);

const EXPECTED: Record<Role, string[]> = {
  admin: ["read", "create", "delete", "manage"],
  manager: ["read", "create", "delete"],
  sales: ["read", "create"],
  viewer: ["read"],
};

describe("can — matriz papel × permissão", () => {
  for (const role of ROLES) {
    for (const action of ["read", "create", "delete", "manage"]) {
      const allowed = EXPECTED[role].includes(action);
      it(`${role} ${allowed ? "pode" : "não pode"} notes:${action}`, () => {
        expect(can({ role }, `notes:${action}`)).toBe(allowed);
      });
    }
  }

  it("nega quando não há ator", () => {
    expect(can(null, "notes:read")).toBe(false);
    expect(can(undefined, "notes:read")).toBe(false);
  });

  it("nega papel que não existe (ex.: dado corrompido)", () => {
    expect(can({ role: "root" as Role }, "notes:read")).toBe(false);
  });

  it("falha alto para permissão desconhecida", () => {
    expect(() => can({ role: "admin" }, "notes:typo")).toThrow(/desconhecida/);
  });
});

describe("requirePermission", () => {
  it("não lança quando permitido", () => {
    expect(() => requirePermission({ role: "sales" }, "notes:create")).not.toThrow();
  });

  it("lança ForbiddenError quando negado", () => {
    expect(() => requirePermission({ role: "viewer" }, "notes:create")).toThrow(ForbiddenError);
    expect(() => requirePermission(null, "notes:read")).toThrow(ForbiddenError);
  });
});
