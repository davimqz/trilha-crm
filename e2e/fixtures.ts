export const E2E_PORT = 3300;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_PASSWORD = "senha-e2e-segura-123";

export const E2E_USERS = {
  admin: { name: "Admin E2E", email: "admin@e2e.test", role: "admin" },
  viewer: { name: "Leitor E2E", email: "viewer@e2e.test", role: "viewer" },
  logout: { name: "Saída E2E", email: "logout@e2e.test", role: "sales" },
} as const;

export const storageStatePath = (role: "admin" | "viewer") => `e2e/.auth/${role}.json`;
