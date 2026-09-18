import { expect, test, type Request } from "@playwright/test";

import { E2E_BASE_URL, storageStatePath } from "./fixtures";

test.describe("gestão de usuários (admin)", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("admin vê o menu, cria, altera papel e desativa um usuário", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Usuários" }).click();
    await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();

    await page.getByLabel("Nome").fill("Beatriz Comercial");
    await page.getByLabel("E-mail").fill("beatriz@e2e.test");
    await page.getByLabel("Papel", { exact: true }).selectOption("sales");
    await page.getByLabel("Senha inicial").fill("senha-inicial-segura-1");
    await page.getByRole("button", { name: "Criar usuário" }).click();
    await expect(page.getByText("Usuário criado.")).toBeVisible();

    const row = page.getByTestId("user-row-beatriz@e2e.test");
    await expect(row).toContainText("Comercial");
    await expect(row).toContainText("Ativo");

    await row.getByLabel("Papel de Beatriz Comercial").selectOption("manager");
    await row.getByRole("button", { name: "Salvar papel" }).click();
    await expect(row.getByText("Papel atualizado.")).toBeVisible();
    await expect(row.getByRole("cell", { name: "Gestor" })).toBeVisible();

    await row.getByRole("button", { name: "Desativar" }).click();
    await expect(row.getByText("Desativado", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Reativar" })).toBeVisible();
  });

  test("validação no servidor: e-mail duplicado e senha curta", async ({ page }) => {
    await page.goto("/settings/users");
    await page.getByLabel("Nome").fill("Duplicado");
    await page.getByLabel("E-mail").fill("viewer@e2e.test");
    await page.getByLabel("Senha inicial").fill("senha-inicial-segura-1");
    await page.getByRole("button", { name: "Criar usuário" }).click();
    await expect(page.getByText("Já existe um usuário com este e-mail.")).toBeVisible();

    await page.getByLabel("E-mail").fill("novo@e2e.test");
    await page.getByLabel("Senha inicial").fill("curta");
    await page.getByRole("button", { name: "Criar usuário" }).click();
    await expect(page.getByText("A senha deve ter ao menos 12 caracteres.")).toBeVisible();
  });

  test("admin não vê ações sobre a própria conta", async ({ page }) => {
    await page.goto("/settings/users");
    const ownRow = page.getByTestId("user-row-admin@e2e.test");
    await expect(ownRow).toContainText("(você)");
    await expect(ownRow.getByRole("button")).toHaveCount(0);
  });
});

test.describe("controle de acesso (viewer)", () => {
  test.use({ storageState: storageStatePath("viewer") });

  test("viewer não vê o menu de usuários e recebe acesso negado", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Usuários" })).toHaveCount(0);

    await page.goto("/settings/users");
    await expect(page.getByRole("heading", { name: "Acesso negado" })).toBeVisible();
    await expect(page.getByText("admin@e2e.test")).toHaveCount(0);
  });
});

test.describe("pentest: Server Action chamada diretamente", () => {
  test("viewer reproduzindo a action de criar usuário do admin é bloqueado", async ({ browser }) => {
    // 1. Captura a requisição real da Server Action feita pelo admin
    const adminContext = await browser.newContext({ storageState: storageStatePath("admin") });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/settings/users");
    await adminPage.getByLabel("Nome").fill("Capturado");
    await adminPage.getByLabel("E-mail").fill("capturado@e2e.test");
    await adminPage.getByLabel("Senha inicial").fill("senha-inicial-segura-1");

    const actionRequestPromise = adminPage.waitForRequest(
      (request) => request.method() === "POST" && !!request.headers()["next-action"],
    );
    await adminPage.getByRole("button", { name: "Criar usuário" }).click();
    const actionRequest: Request = await actionRequestPromise;
    await expect(adminPage.getByText("Usuário criado.")).toBeVisible();

    // 2. Reenvia a mesma action com outro e-mail usando a sessão do viewer
    const body = actionRequest.postData()!.replace("capturado@e2e.test", "invasor@e2e.test");
    const viewerContext = await browser.newContext({ storageState: storageStatePath("viewer") });
    const headers = actionRequest.headers();
    const response = await viewerContext.request.post(actionRequest.url(), {
      headers: {
        "next-action": headers["next-action"],
        "content-type": headers["content-type"],
        accept: "text/x-component",
        origin: E2E_BASE_URL,
      },
      data: body,
    });

    expect(await response.text()).toContain("Você não tem permissão para esta ação.");

    // 3. Confirma que nada foi criado
    await adminPage.reload();
    await expect(adminPage.getByTestId("user-row-invasor@e2e.test")).toHaveCount(0);

    await adminContext.close();
    await viewerContext.close();
  });
});
