import { ROLES, type Role } from "@/core/rbac/roles";

import type { ModuleManifest, NavigationItem } from "./types";

export type Permission = `${string}:${string}`;

export function permissionKey(moduleId: string, action: string): Permission {
  return `${moduleId}:${action}`;
}

// Deny by default: um papel só tem o que algum módulo declarou explicitamente para ele
export function buildPermissionIndex(modules: readonly ModuleManifest[]): Record<Role, ReadonlySet<Permission>> {
  const index = Object.fromEntries(ROLES.map((role) => [role, new Set<Permission>()])) as Record<
    Role,
    Set<Permission>
  >;

  for (const manifest of modules) {
    for (const [action, definition] of Object.entries(manifest.permissions)) {
      for (const role of definition.roles) index[role].add(permissionKey(manifest.id, action));
    }
  }

  return index;
}

export function getNavigationForRole(modules: readonly ModuleManifest[], role: Role): NavigationItem[] {
  const allowed = buildPermissionIndex(modules)[role];
  return modules.flatMap((manifest) =>
    (manifest.navigation ?? []).filter((item) => allowed.has(permissionKey(manifest.id, item.permission))),
  );
}
