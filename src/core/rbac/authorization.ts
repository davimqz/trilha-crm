import { buildPermissionIndex, type Permission } from "@/core/modules/permissions";
import type { ModuleManifest } from "@/core/modules/types";

import type { Role } from "./roles";

export type Actor = {
  userId: string;
  name: string;
  email: string;
  role: Role;
};

export class ForbiddenError extends Error {
  constructor(message = "Você não tem permissão para esta ação.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function createAuthorization(modules: readonly ModuleManifest[]) {
  const index = buildPermissionIndex(modules);
  const knownPermissions = new Set(Object.values(index).flatMap((permissions) => [...permissions]));

  function can(actor: Pick<Actor, "role"> | null | undefined, permission: Permission): boolean {
    // Erro de programação (typo ou módulo não registrado): falha alto em vez de negar em silêncio
    if (!knownPermissions.has(permission)) throw new Error(`Permissão desconhecida: ${permission}`);
    if (!actor) return false;
    return index[actor.role]?.has(permission) ?? false;
  }

  function requirePermission(actor: Pick<Actor, "role"> | null | undefined, permission: Permission): void {
    if (!can(actor, permission)) throw new ForbiddenError();
  }

  return { can, requirePermission };
}
