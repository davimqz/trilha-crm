import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

import { E2E_BASE_URL, E2E_PORT } from "./e2e/fixtures";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL não definida (veja .env.example)");

// Roda contra o build de produção (`pnpm build` antes) e o banco de TESTE
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    locale: "pt-BR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: E2E_BASE_URL,
      BETTER_AUTH_SECRET: "segredo-somente-para-testes-e2e-0123456789",
      // Os testes simulam IPs distintos por papel via X-Forwarded-For (não há proxy na frente)
      AUTH_IP_HEADER: "x-forwarded-for",
    },
  },
});
