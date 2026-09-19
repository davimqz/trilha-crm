import { expect, test } from "@playwright/test";

import { E2E_PASSWORD, E2E_USERS } from "./fixtures";

test.describe("autenticação", () => {
  test("visitante sem sessão é levado ao login", async ({ page }) => {
    for (const path of ["/", "/settings/users", "/account/password"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("heading", { name: "Trilha CRM" })).toBeVisible();
  });

  test("login inválido mostra mensagem genérica", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(E2E_USERS.viewer.email);
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();

    // filter: o anunciador de rotas do Next também usa role="alert"
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login e logout", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(E2E_USERS.logout.email);
    await page.getByLabel("Senha").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: `Olá, ${E2E_USERS.logout.name}` })).toBeVisible();

    // Menu lateral: itens do papel sales (sem Usuários) e menu da conta com "Sair"
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link", { name: "Leads" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Usuários" })).toHaveCount(0);

    await page.getByRole("button", { name: `Conta de ${E2E_USERS.logout.name}` }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("health checks", () => {
  test("públicos, sem cache e sem detalhes internos", async ({ request }) => {
    for (const path of ["/api/health", "/api/health/live"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(await response.json()).toEqual({ status: "ok" });
    }
  });
});
