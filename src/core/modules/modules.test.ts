import { describe, expect, it } from "vitest";

import { buildPermissionIndex, getNavigationForRole } from "./permissions";
import { defineModule, type ModuleManifest } from "./types";
import { validateModules } from "./validate-modules";

const notes = defineModule({
  id: "notes",
  name: "Notas",
  permissions: {
    read: { description: "Ver notas", roles: ["admin", "manager", "sales", "viewer"] },
    delete: { description: "Excluir notas", roles: ["admin", "manager"] },
  },
  navigation: [{ label: "Notas", href: "/notes", permission: "read" }],
});

const reports = defineModule({
  id: "sales-reports",
  name: "Relatórios",
  permissions: { read: { description: "Ver relatórios", roles: ["admin", "manager"] } },
  navigation: [{ label: "Relatórios", href: "/reports", permission: "read" }],
});

describe("validateModules", () => {
  it("aceita manifestos válidos", () => {
    expect(validateModules([notes, reports])).toEqual([]);
  });

  it("rejeita id duplicado", () => {
    expect(validateModules([notes, notes]).join()).toMatch(/id duplicado/);
  });

  it("rejeita id fora de kebab-case", () => {
    expect(validateModules([{ ...notes, id: "Notes_X" }]).join()).toMatch(/kebab-case/);
  });

  it("rejeita módulo sem permissões", () => {
    expect(validateModules([{ ...notes, permissions: {}, navigation: [] }]).join()).toMatch(/ao menos uma/);
  });

  it("rejeita papel desconhecido", () => {
    const invalid = {
      ...notes,
      permissions: { read: { description: "x", roles: ["admin", "root"] } },
    } as unknown as ModuleManifest;
    expect(validateModules([invalid]).join()).toMatch(/papel desconhecido "root"/);
  });

  it("exige admin em toda permissão", () => {
    const invalid: ModuleManifest = { ...notes, permissions: { read: { description: "x", roles: ["viewer"] } } };
    expect(validateModules([invalid]).join()).toMatch(/admin deve ter todas/);
  });

  it("rejeita navegação apontando para permissão inexistente", () => {
    const invalid: ModuleManifest = { ...notes, navigation: [{ label: "x", href: "/x", permission: "write" }] };
    expect(validateModules([invalid]).join()).toMatch(/não declarada/);
  });

  it("não aceita propriedades herdadas como permissão", () => {
    const invalid: ModuleManifest = { ...notes, navigation: [{ label: "x", href: "/x", permission: "toString" }] };
    expect(validateModules([invalid]).join()).toMatch(/não declarada/);
  });

  it("rejeita rotas de navegação duplicadas entre módulos", () => {
    const clash: ModuleManifest = { ...reports, navigation: [{ label: "x", href: "/notes", permission: "read" }] };
    expect(validateModules([notes, clash]).join()).toMatch(/rota duplicada/);
  });
});

describe("buildPermissionIndex", () => {
  const index = buildPermissionIndex([notes, reports]);

  it("concede ao admin todas as permissões", () => {
    expect([...index.admin].sort()).toEqual(["notes:delete", "notes:read", "sales-reports:read"]);
  });

  it("concede ao viewer apenas o que foi declarado", () => {
    expect([...index.viewer]).toEqual(["notes:read"]);
  });

  it("nega por padrão o que não foi declarado", () => {
    expect(index.sales.has("notes:delete")).toBe(false);
    expect(index.sales.has("sales-reports:read")).toBe(false);
  });
});

describe("getNavigationForRole", () => {
  it("mostra só os itens permitidos ao papel", () => {
    expect(getNavigationForRole([notes, reports], "sales").map((item) => item.href)).toEqual(["/notes"]);
    expect(getNavigationForRole([notes, reports], "manager").map((item) => item.href)).toEqual([
      "/notes",
      "/reports",
    ]);
  });
});
