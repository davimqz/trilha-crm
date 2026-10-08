import { expect, test, type Locator, type Page } from "@playwright/test";

import { ADMIN_LEAD, E2E_BASE_URL, storageStatePath } from "./fixtures";

const PDF = Buffer.from("%PDF-1.7\nproposta e2e");
// PNG 1x1 válido (para o navegador conseguir decodificar na pré-visualização)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....word/document.xml....")]);

async function createLead(page: Page, column: string, lead: { name: string; email: string; phone: string; birthDate?: string }) {
  await page.getByRole("button", { name: `Adicionar lead em ${column}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill(lead.name);
  await dialog.getByLabel("E-mail").fill(lead.email);
  await dialog.getByLabel("Telefone com DDD").fill(lead.phone);
  if (lead.birthDate) await dialog.getByLabel("Data de nascimento (opcional)").fill(lead.birthDate);
  await dialog.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByTestId(`lead-card-${lead.email}`)).toBeVisible();
  // Espera o diálogo terminar de fechar: durante a animação o overlay ainda captura o ponteiro
  await expect(page.getByRole("dialog")).toHaveCount(0);
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

    // "+" só em Prospect e Primeiro Contato; os demais estágios recebem leads só pelo arraste
    await expect(page.getByRole("button", { name: /Adicionar lead em/ })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Adicionar lead em Prospect" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar lead em Primeiro Contato" })).toBeVisible();

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

    // Arrastar não pode abrir o painel
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("column-meeting_scheduled").getByTestId("lead-card-helena@e2e.test")).toBeVisible();
  });

  test("clicar em qualquer parte do card (ou Enter) abre o painel", async ({ page }) => {
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Nina Clique", email: "nina@e2e.test", phone: "11911110000" });
    const card = page.getByTestId("lead-card-nina@e2e.test");

    await card.getByText("(11) 91111-0000").click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Nina Clique" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Nina Clique" })).toBeVisible();
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
    // Status é só leitura: vem da coluna atual do kanban
    await expect(page.getByLabel("Status")).toHaveValue("Prospect");
    await expect(page.getByLabel("Status")).toBeDisabled();
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
    await row.getByRole("link", { name: "Baixar Proposta.pdf" }).click();
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

  test("card abre em modal centralizado", async ({ page }) => {
    await page.goto("/leads");
    await page.getByTestId(`lead-card-${ADMIN_LEAD.email}`).click();
    const modal = page.getByTestId("lead-dialog");
    await expect(modal).toBeVisible();
    const box = (await modal.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(4);
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(4);
  });

  test("anexos: visualizar PDF, imagem e texto; Word só baixar", async ({ page }) => {
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Olga Anexos", email: "olga@e2e.test", phone: "11900001111" });
    await openLead(page, "Olga Anexos");
    await page.getByRole("tab", { name: /Anexos/ }).click();

    const input = page.getByTestId("attachment-input");
    await input.setInputFiles({ name: "contrato.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByTestId("attachment-row")).toHaveCount(1);
    await input.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByTestId("attachment-row")).toHaveCount(2);
    await input.setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("linha 1\n<b>não é HTML</b>") });
    await expect(page.getByTestId("attachment-row")).toHaveCount(3);
    await input.setInputFiles({ name: "proposta.docx", mimeType: "application/octet-stream", buffer: DOCX });
    await expect(page.getByTestId("attachment-row")).toHaveCount(4);

    const preview = page.getByTestId("attachment-preview");
    const close = () => preview.getByRole("button", { name: "Fechar" }).click();

    await page.getByRole("button", { name: "Visualizar contrato.pdf" }).click();
    await expect(preview.locator("iframe")).toHaveAttribute("src", /\/preview$/);
    await expect(preview.getByRole("link", { name: "Baixar" })).toBeVisible();
    await close();

    await page.getByRole("button", { name: "Visualizar foto.png" }).click();
    const image = preview.getByRole("img", { name: "foto.png" });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(1);
    await close();

    await page.getByRole("button", { name: "Visualizar notas.txt" }).click();
    await expect(preview.locator("pre")).toContainText("<b>não é HTML</b>");
    await expect(preview.locator("pre b")).toHaveCount(0);
    await close();

    // Word/Excel: sem visualização (exigiria serviço externo), só baixar
    await expect(page.getByRole("button", { name: "Visualização indisponível para DOCX" })).toBeDisabled();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Baixar proposta.docx" }).click();
    expect((await download).suggestedFilename()).toBe("proposta.docx");

    // O modal do lead continua aberto depois de fechar a pré-visualização
    await expect(page.getByTestId("lead-dialog")).toBeVisible();
  });

  test("data de nascimento no cadastro e na edição, com evento conciso na linha do tempo", async ({ page }) => {
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Olga Nascimento", email: "nascimento@e2e.test", phone: "11955550000", birthDate: "1992-07-15" });
    await openLead(page, "Olga Nascimento");
    await expect(page.getByTestId("lead-dialog")).toContainText("15/07/1992");

    await page.getByRole("tab", { name: "Editar" }).click();
    await page.getByLabel("Data de nascimento (opcional)").fill("1992-07-16");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();

    await page.getByRole("tab", { name: "Linha do tempo" }).click();
    const timeline = page.getByTestId("timeline");
    await expect(timeline).toContainText("Atualização de data de nascimento");
    await expect(timeline).toContainText("Lead criado");
    // O valor da data não aparece no histórico
    await expect(timeline).not.toContainText("16/07/1992");
  });

  test("editar e excluir anotação, com registro na linha do tempo", async ({ page }) => {
    await page.goto("/leads");
    await createLead(page, "Prospect", { name: "Quênia Notas", email: "quenia@e2e.test", phone: "11944440000" });
    await openLead(page, "Quênia Notas");
    await page.getByRole("tab", { name: /Anotações/ }).click();
    await page.getByRole("textbox", { name: "Nova anotação" }).click();
    await page.keyboard.type("Texto com erro de digitaçao");
    await page.getByRole("button", { name: "Adicionar anotação" }).click();
    const note = page.getByTestId("lead-note").first();
    await expect(note).toContainText("digitaçao");

    await note.getByRole("button", { name: "Editar anotação" }).click();
    const editor = page.getByRole("textbox", { name: "Editar anotação" });
    await editor.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Texto corrigido");
    await note.getByRole("button", { name: "Salvar" }).click();
    await expect(note).toContainText("Texto corrigido");
    await expect(note).toContainText(/Editada em \d{2}\/\d{2}\/\d{4}/);

    await note.getByRole("button", { name: "Excluir anotação" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByTestId("lead-note")).toHaveCount(0);

    await page.getByRole("tab", { name: "Linha do tempo" }).click();
    await expect(page.getByTestId("timeline")).toContainText("Anotação editada");
    await expect(page.getByTestId("timeline")).toContainText("Anotação excluída");
    // Resumo conciso: o texto da anotação não aparece na linha do tempo
    await expect(page.getByTestId("timeline")).not.toContainText("Texto corrigido");
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

    // Card não arrastável também abre ao clicar no corpo
    await page.getByTestId(`lead-card-${ADMIN_LEAD.email}`).getByText(ADMIN_LEAD.email).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: ADMIN_LEAD.name })).toBeVisible();
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

    // Acima de 4 MB: recusado pelo Content-Length, antes de ler o corpo
    const big = Buffer.alloc(4 * 1024 * 1024 + 200 * 1024);
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

    // Pré-visualização: inline, só dentro do próprio CRM, sem cache
    const preview = await viewerContext.request.get(`${downloadUrl}/preview`);
    expect(preview.status()).toBe(200);
    expect(preview.headers()["content-disposition"]).toMatch(/^inline;/);
    expect(preview.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(preview.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(preview.headers()["x-content-type-options"]).toBe("nosniff");
    expect((await anonymous.get(`${downloadUrl}/preview`)).status()).toBe(401);
    // Download continua sem poder ser embutido
    expect(download.headers()["x-frame-options"]).toBe("DENY");
    // Páginas do app mantêm a CSP global e o bloqueio de iframe
    const appPage = await viewerContext.request.get("/leads");
    expect(appPage.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(appPage.headers()["x-frame-options"]).toBe("DENY");

    // Texto sempre servido como text/plain na pré-visualização (nunca HTML)
    const csv = await admin.post(uploadUrl, {
      headers: { origin: E2E_BASE_URL },
      multipart: { file: { name: "x.csv", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") } },
    });
    const { id: csvId } = (await csv.json()) as { id: string };
    const csvPreview = await viewerContext.request.get(`${uploadUrl}/${csvId}/preview`);
    expect(csvPreview.headers()["content-type"]).toMatch(/^text\/plain/);
    expect(csvPreview.headers()["content-security-policy"]).toContain("sandbox");

    // Word não tem pré-visualização
    const docx = await admin.post(uploadUrl, {
      headers: { origin: E2E_BASE_URL },
      multipart: { file: { name: "a.docx", mimeType: "application/octet-stream", buffer: DOCX } },
    });
    const { id: docxId } = (await docx.json()) as { id: string };
    expect((await viewerContext.request.get(`${uploadUrl}/${docxId}/preview`)).status()).toBe(415);

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
    // Só o card do Mário na tela: o arraste não depende de quantos leads os outros testes criaram
    await page.goto("/leads?q=M%C3%A1rio");
    await expect(page.getByTestId("lead-card-mario@e2e.test")).toBeVisible();

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
