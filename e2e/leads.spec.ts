import { expect, test, type Locator, type Page } from "@playwright/test";

import { ADMIN_LEAD, E2E_BASE_URL, storageStatePath } from "./fixtures";

const PDF = Buffer.from("%PDF-1.7\nproposta e2e");

async function createLead(page: Page, column: string, lead: { name: string; email: string; phone: string }) {
  await page.getByRole("button", { name: `Adicionar lead em ${column}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill(lead.name);
  await dialog.getByLabel("E-mail").fill(lead.email);
  await dialog.getByLabel("Telefone com DDD").fill(lead.phone);
  await dialog.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByTestId(`lead-card-${lead.email}`)).toBeVisible();
}

// Solta na mesma altura do card: as colunas se esticam até a mais alta, então a área de drop cobre essa linha
async function dragTo(page: Page, card: Locator, column: Locator) {
  await card.scrollIntoViewIfNeeded();
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  const y = from.y + from.height - 8;
  await page.mouse.move(from.x + from.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 15, y, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, y, { steps: 15 });
  await page.mouse.up();
}

async function openLead(page: Page, name: string) {
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test.describe("leads (admin)", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("mostra as 7 colunas na ordem e cadastra pelo +", async ({ page }) => {
    await page.goto("/leads");
    const titles = await page.getByTestId("leads-board").getByRole("heading", { level: 2 }).allInnerTexts();
    expect(titles).toEqual([
      "Prospect",
      "Primeiro Contato",
      "Reunião Agendada",
      "Reunião Desmarcada",
      "Reunião Realizada",
      "Convertido",
      "Não convertido",
    ]);

    await createLead(page, "Primeiro Contato", { name: "Fernanda Rocha", email: "fernanda@e2e.test", phone: "(11) 98888-7777" });
    await expect(page.getByTestId("column-first_contact").getByTestId("lead-card-fernanda@e2e.test")).toContainText("(11) 98888-7777");
  });

  test("validação no servidor mantém o que foi digitado", async ({ page }) => {
    await page.goto("/leads");
    await page.getByRole("button", { name: "Adicionar lead em Prospect" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome", { exact: true }).fill("Gustavo");
    await dialog.getByLabel("E-mail").fill(ADMIN_LEAD.email);
    await dialog.getByLabel("Telefone com DDD").fill("(20) 91234-5678");
    await dialog.getByRole("button", { name: "Cadastrar" }).click();

    await expect(dialog.getByText("Telefone inválido")).toBeVisible();
    await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Gustavo");

    await dialog.getByLabel("Telefone com DDD").fill("(21) 91234-5678");
    await dialog.getByRole("button", { name: "Cadastrar" }).click();
    await expect(dialog.getByText("Já existe um lead com este e-mail.")).toBeVisible();
  });

  test("arrastar entre colunas persiste o novo status", async ({ page }) => {
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Helena Arraste", email: "helena@e2e.test", phone: "11977776666" });

    await dragTo(page, page.getByTestId("lead-card-helena@e2e.test"), page.getByTestId("column-meeting_scheduled"));
    await expect(page.getByTestId("column-meeting_scheduled").getByTestId("lead-card-helena@e2e.test")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("column-meeting_scheduled").getByTestId("lead-card-helena@e2e.test")).toBeVisible();
  });

  test("busca por nome, filtro e ordenação ficam na URL", async ({ page }) => {
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Ícaro Busca", email: "icaro@e2e.test", phone: "11966665555" });

    await page.getByLabel("Buscar por nome").fill("ícaro");
    await expect(page).toHaveURL(/q=%C3%ADcaro|q=ícaro/);
    await expect(page.getByTestId("lead-card-icaro@e2e.test")).toBeVisible();
    await expect(page.getByTestId(`lead-card-${ADMIN_LEAD.email}`)).toHaveCount(0);

    await page.goto("/leads?owner=me&sort=name_asc");
    await expect(page.getByLabel("Ordenar por")).toContainText("Nome (A–Z)");
    await expect(page.getByRole("button", { name: /Filtros/ })).toContainText("1");
  });

  test("painel: editar, anotar com formatação, anexar, arquivar e excluir", async ({ page }) => {
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Joana Painel", email: "joana@e2e.test", phone: "11955554444" });
    await openLead(page, "Joana Painel");

    // Informações
    await expect(page.getByRole("dialog").getByText("joana@e2e.test", { exact: true })).toBeVisible();

    // Editar
    await page.getByRole("tab", { name: "Editar" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Joana Editada");
    await page.getByLabel("Status").selectOption("meeting_done");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Joana Editada" })).toBeVisible();
    await expect(page.getByText(/Última edição: \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/)).toBeVisible();

    // Anotações
    await page.getByRole("tab", { name: /Anotações/ }).click();
    const editor = page.getByRole("textbox", { name: "Nova anotação" });
    await editor.click();
    await page.getByRole("button", { name: "Negrito" }).click();
    await page.keyboard.type("Importante");
    await page.getByRole("button", { name: "Negrito" }).click();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Lista numerada" }).click();
    await page.keyboard.type("Primeiro passo");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Cor do texto: Azul" }).click();
    await page.keyboard.type("Texto azul");
    await page.getByRole("button", { name: "Adicionar anotação" }).click();

    const note = page.getByTestId("lead-note").first();
    await expect(note.locator("strong", { hasText: "Importante" })).toBeVisible();
    await expect(note.locator("ol li", { hasText: "Primeiro passo" })).toBeVisible();
    await expect(note.locator('span[style*="color"]', { hasText: "Texto azul" })).toBeVisible();
    await expect(note.getByRole("heading", { level: 4 })).toHaveText(/\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);

    // Anexos
    await page.getByRole("tab", { name: /Anexos/ }).click();
    await page.getByTestId("attachment-input").setInputFiles({ name: "Proposta.pdf", mimeType: "application/pdf", buffer: PDF });
    const row = page.getByTestId("attachment-row");
    await expect(row).toContainText("Proposta.pdf");
    await expect(row).toContainText("PDF");

    const downloadPromise = page.waitForEvent("download");
    await row.getByRole("link", { name: "Proposta.pdf" }).click();
    expect((await downloadPromise).suggestedFilename()).toBe("Proposta.pdf");

    await page.getByTestId("attachment-input").setInputFiles({ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>") });
    await expect(page.getByText("Tipo de arquivo não permitido")).toBeVisible();

    await row.getByRole("button", { name: "Remover Proposta.pdf" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remover" }).click();
    await expect(page.getByTestId("attachment-row")).toHaveCount(0);

    // Arquivar → aba Arquivados → desarquivar
    await page.getByRole("tab", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Arquivar" }).click();
    await expect(page.getByText("Lead arquivado.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("lead-card-joana@e2e.test")).toHaveCount(0);

    await page.getByRole("link", { name: "Arquivados" }).click();
    await expect(page.getByTestId("archived-table")).toContainText("Joana Editada");
    await page.getByRole("link", { name: "Joana Editada" }).click();
    await page.getByRole("tab", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Desarquivar" }).click();
    await expect(page.getByText("Lead desarquivado.")).toBeVisible();

    // Excluir
    await page.getByRole("button", { name: "Excluir" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir definitivamente" }).click();
    await expect(page.getByText("Lead excluído.")).toBeVisible();
    await page.goto("/leads");
    await expect(page.getByTestId("lead-card-joana@e2e.test")).toHaveCount(0);
  });

  test("XSS: HTML digitado na anotação é exibido como texto", async ({ page }) => {
    let dialogOpened = false;
    page.on("dialog", async (dialog) => {
      dialogOpened = true;
      await dialog.dismiss();
    });
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Karla XSS", email: "karla@e2e.test", phone: "11944443333" });
    await openLead(page, "Karla XSS");
    await page.getByRole("tab", { name: /Anotações/ }).click();
    await page.getByRole("textbox", { name: "Nova anotação" }).click();
    await page.keyboard.type('<img src=x onerror="alert(1)"><script>alert(2)</script>');
    await page.getByRole("button", { name: "Adicionar anotação" }).click();

    const note = page.getByTestId("lead-note").first();
    await expect(note).toContainText('<img src=x onerror="alert(1)">');
    await expect(note.locator("img, script")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("lead-note").first()).toBeVisible();
    expect(dialogOpened).toBe(false);
  });
});

test.describe("leads (viewer)", () => {
  test.use({ storageState: storageStatePath("viewer") });

  test("vê o kanban e o card, mas sem nenhuma ação de alteração", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByTestId(`lead-card-${ADMIN_LEAD.email}`)).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar lead em/ })).toHaveCount(0);
    await expect(page.getByTestId(`lead-card-${ADMIN_LEAD.email}`)).not.toHaveAttribute("aria-roledescription", /arrastável/);

    await openLead(page, ADMIN_LEAD.name);
    await page.getByRole("tab", { name: "Editar" }).click();
    await expect(page.getByLabel("Nome", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Arquivar|Excluir/ })).toHaveCount(0);
    await page.getByRole("tab", { name: /Anotações/ }).click();
    await expect(page.getByRole("textbox", { name: "Nova anotação" })).toHaveCount(0);
    await page.getByRole("tab", { name: /Anexos/ }).click();
    await expect(page.getByRole("button", { name: "Adicionar" })).toHaveCount(0);
  });
});

test.describe("leads (sales)", () => {
  test.use({ storageState: storageStatePath("sales") });

  test("cadastra e edita o próprio lead, mas não altera o lead de outro responsável", async ({ page }) => {
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Lucas do Vendedor", email: "lucas@e2e.test", phone: "11933332222" });
    await expect(page.getByTestId("lead-card-lucas@e2e.test")).toHaveAttribute("aria-roledescription", /arrastável/);
    await expect(page.getByTestId(`lead-card-${ADMIN_LEAD.email}`)).not.toHaveAttribute("aria-roledescription", /arrastável/);

    await openLead(page, ADMIN_LEAD.name);
    await page.getByRole("tab", { name: "Editar" }).click();
    await expect(page.getByText("Somente o responsável, gestores e administradores podem editar este lead.")).toBeVisible();
  });
});

test.describe("pentest: endpoints de anexos e Server Actions", () => {
  test("upload/download exigem sessão, mesma origem, permissão e tamanho", async ({ browser, playwright }) => {
    // Descobre o id do lead do admin pela UI (como um atacante veria na URL)
    const adminContext = await browser.newContext({ storageState: storageStatePath("admin") });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/leads");
    await adminPage.getByRole("link", { name: ADMIN_LEAD.name, exact: true }).click();
    await expect(adminPage).toHaveURL(/lead=/);
    const leadId = new URL(adminPage.url()).searchParams.get("lead")!;
    const uploadUrl = `/api/leads/${leadId}/attachments`;
    const file = { name: "a.pdf", mimeType: "application/pdf", buffer: PDF };

    // Sem sessão
    const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
    expect((await anonymous.post(uploadUrl, { headers: { origin: E2E_BASE_URL }, multipart: { file } })).status()).toBe(401);

    // Outra origem (CSRF), mesmo com sessão válida
    const admin = adminContext.request;
    expect((await admin.post(uploadUrl, { headers: { origin: "https://evil.test" }, multipart: { file } })).status()).toBe(403);

    // Acima de 10 MB: recusado pelo Content-Length, antes de ler o corpo
    const big = Buffer.alloc(10 * 1024 * 1024 + 200 * 1024);
    PDF.copy(big);
    const tooBig = await admin.post(uploadUrl, {
      headers: { origin: E2E_BASE_URL },
      multipart: { file: { name: "grande.pdf", mimeType: "application/pdf", buffer: big } },
    });
    expect(tooBig.status()).toBe(413);

    // Viewer (sem permissão de edição)
    const viewerContext = await browser.newContext({ storageState: storageStatePath("viewer") });
    expect((await viewerContext.request.post(uploadUrl, { headers: { origin: E2E_BASE_URL }, multipart: { file } })).status()).toBe(403);

    // Admin sobe um arquivo legítimo
    const created = await admin.post(uploadUrl, { headers: { origin: E2E_BASE_URL }, multipart: { file } });
    expect(created.status()).toBe(201);
    const { id: attachmentId } = (await created.json()) as { id: string };

    // Download: sem sessão → 401; com sessão → headers seguros
    const downloadUrl = `${uploadUrl}/${attachmentId}`;
    expect((await anonymous.get(downloadUrl)).status()).toBe(401);
    const download = await viewerContext.request.get(downloadUrl);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-disposition"]).toMatch(/^attachment;/);
    expect(download.headers()["x-content-type-options"]).toBe("nosniff");
    expect(download.headers()["content-security-policy"]).toContain("sandbox");
    expect(download.headers()["content-type"]).toBe("application/pdf");

    // IDOR: anexo existente, mas pedido por outro lead
    expect((await viewerContext.request.get(`/api/leads/00000000-0000-4000-8000-000000000000/attachments/${attachmentId}`)).status()).toBe(404);
    // Ids malformados
    expect((await viewerContext.request.get(`/api/leads/..%2F..%2Fetc/attachments/x`)).status()).toBeGreaterThanOrEqual(400);

    await anonymous.dispose();
    await adminContext.close();
    await viewerContext.close();
  });

  test("sales reproduzindo a action de mover com o lead de outro é bloqueado", async ({ browser }) => {
    // Captura uma chamada real de moveLeadAction feita pelo sales no próprio lead
    const salesContext = await browser.newContext({ storageState: storageStatePath("sales") });
    const page = await salesContext.newPage();
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Mário Captura", email: "mario@e2e.test", phone: "11922221111" });

    const actionRequest = page.waitForRequest((request) => request.method() === "POST" && !!request.headers()["next-action"]);
    await dragTo(page, page.getByTestId("lead-card-mario@e2e.test"), page.getByTestId("column-first_contact"));
    const captured = await actionRequest;
    await expect(page.getByTestId("column-first_contact").getByTestId("lead-card-mario@e2e.test")).toBeVisible();

    // Troca o id pelo lead do admin e reenvia
    const adminPage = await (await browser.newContext({ storageState: storageStatePath("admin") })).newPage();
    await adminPage.goto("/leads");
    await adminPage.getByRole("link", { name: ADMIN_LEAD.name, exact: true }).click();
    await expect(adminPage).toHaveURL(/lead=/);
    const adminLeadId = new URL(adminPage.url()).searchParams.get("lead")!;
    const body = JSON.stringify([adminLeadId, "converted"]);

    const headers = captured.headers();
    const response = await salesContext.request.post(captured.url(), {
      headers: { "next-action": headers["next-action"], "content-type": headers["content-type"], accept: "text/x-component", origin: E2E_BASE_URL },
      data: body,
    });
    expect(await response.text()).toContain("Você só pode alterar leads em que é o responsável.");

    await adminPage.reload();
    await expect(adminPage.getByTestId("column-prospect").getByTestId(`lead-card-${ADMIN_LEAD.email}`)).toBeVisible();
    await salesContext.close();
  });
});
