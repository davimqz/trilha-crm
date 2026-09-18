import { isRole } from "@/core/rbac/roles";

import type { ModuleManifest } from "./types";

const MODULE_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ACTION_PATTERN = /^[a-z]+(-[a-z]+)*$/;

export function validateModules(modules: readonly ModuleManifest[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenHrefs = new Set<string>();

  for (const manifest of modules) {
    const { id } = manifest;

    if (!MODULE_ID_PATTERN.test(id)) errors.push(`Módulo "${id}": id deve ser kebab-case`);
    if (seenIds.has(id)) errors.push(`Módulo "${id}": id duplicado`);
    seenIds.add(id);

    const actions = Object.keys(manifest.permissions);
    if (actions.length === 0) errors.push(`Módulo "${id}": precisa declarar ao menos uma permissão`);

    for (const action of actions) {
      const definition = manifest.permissions[action];
      if (!ACTION_PATTERN.test(action)) errors.push(`Permissão "${id}:${action}": ação deve ser kebab-case`);
      for (const role of definition.roles) {
        if (!isRole(role)) errors.push(`Permissão "${id}:${action}": papel desconhecido "${String(role)}"`);
      }
      if (!definition.roles.includes("admin")) {
        errors.push(`Permissão "${id}:${action}": o papel admin deve ter todas as permissões`);
      }
    }

    for (const item of manifest.navigation ?? []) {
      if (!Object.hasOwn(manifest.permissions, item.permission)) {
        errors.push(`Navegação "${item.href}" do módulo "${id}": permissão "${item.permission}" não declarada`);
      }
      if (seenHrefs.has(item.href)) errors.push(`Navegação "${item.href}": rota duplicada`);
      seenHrefs.add(item.href);
    }
  }

  return errors;
}

export function assertValidModules(modules: readonly ModuleManifest[]): void {
  const errors = validateModules(modules);
  if (errors.length > 0) throw new Error(`Registry de módulos inválido:\n- ${errors.join("\n- ")}`);
}
