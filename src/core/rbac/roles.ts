// Papéis fixos definidos no ADR-003. A aplicação das permissões chega na Entrega 02.
export const ROLES = ["admin", "manager", "sales", "viewer"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  manager: "Gestor",
  sales: "Comercial",
  viewer: "Leitura",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
