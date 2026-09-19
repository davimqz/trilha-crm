import type { Role } from "@/core/rbac/roles";

export type PermissionDefinition = {
  description: string;
  // Papéis que recebem a permissão. "admin" é obrigatório em todas.
  roles: readonly Role[];
};

// Ícones do menu lateral: nomes (serializáveis) mapeados para componentes em src/app/(app)/app-sidebar.tsx
export const NAV_ICONS = ["home", "kanban", "users", "building", "settings", "handshake"] as const;
export type NavIcon = (typeof NAV_ICONS)[number];

export type NavigationItem = {
  label: string;
  href: `/${string}`;
  // Ação do próprio módulo exigida para ver o item (ex.: "read")
  permission: string;
  icon?: NavIcon;
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
