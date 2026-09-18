export const E2E_PORT = 3300;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_PASSWORD = "senha-e2e-segura-123";

export const E2E_USERS = {
  admin: { name: "Admin E2E", email: "admin@e2e.test", role: "admin" },
  viewer: { name: "Leitor E2E", email: "viewer@e2e.test", role: "viewer" },
  sales: { name: "Vendedor E2E", email: "sales@e2e.test", role: "sales" },
  logout: { name: "Saída E2E", email: "logout@e2e.test", role: "sales" },
} as const;

export type SessionRole = "admin" | "viewer" | "sales";

export const storageStatePath = (role: SessionRole) => `e2e/.auth/${role}.json`;

// Lead criado no setup, pertencente ao admin (para testar o que sales/viewer NÃO podem fazer)
export const ADMIN_LEAD = { name: "Lead do Admin", email: "lead-admin@e2e.test", phone: "11912345678" };
