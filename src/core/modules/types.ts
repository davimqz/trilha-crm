import type { Role } from "@/core/rbac/roles";

export type PermissionDefinition = {
  description: string;
  // Papéis que recebem a permissão. "admin" é obrigatório em todas.
  roles: readonly Role[];
};

export type NavigationItem = {
  label: string;
  href: `/${string}`;
  // Ação do próprio módulo exigida para ver o item (ex.: "read")
  permission: string;
};

export type ModuleManifest = {
  // kebab-case e único; vira o prefixo das permissões ("<id>:<ação>")
  id: string;
  name: string;
  description?: string;
  permissions: Readonly<Record<string, PermissionDefinition>>;
  navigation?: readonly NavigationItem[];
};

export function defineModule<const TManifest extends ModuleManifest>(manifest: TManifest): TManifest {
  return manifest;
}
