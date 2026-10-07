import { expect, test, type Page } from "@playwright/test";

import { ADMIN_LEAD, storageStatePath } from "./fixtures";

async function activeCount(page: Page) {
  const text = await page.getByTestId("active-clients").innerText();
  return Number(text.replace(/\D/g, ""));
}

// Arrasta o card até a coluna (viewport largo: todas as colunas do kanban ficam visíveis)
async function dragToColumn(page: Page, email: string, status: string) {
  const card = page.getByTestId(`lead-card-${email}`);
  const from = (await card.boundingBox())!;
  const to = (await page.getByTestId(`column-${status}`).boundingBox())!;
  const y = from.y + from.height - 8;
  // O card muda de coluna na hora (otimista): espera a Server Action responder antes de seguir
  const saved = page.waitForResponse((response) => response.request().method() === "POST" && !!response.request().headers()["next-action"]);
  await page.mouse.move(from.x + from.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 15, y, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, y, { steps: 15 });
  await page.mouse.up();
  await saved;
  await expect(page.getByTestId(`column-${status}`).getByTestId(`lead-card-${email}`)).toBeVisible();
}

// Cadastra em "Prospect" (só Prospect e Primeiro Contato têm +) e arrasta para "Convertido"
async function createAndConvertByDrag(page: Page, lead: { name: string; email: string; phone: string }) {
  await page.goto("/leads");
  await page.getByRole("button", { name: "Adicionar lead em Prospect" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill(lead.name);
  await dialog.getByLabel("E-mail").fill(lead.email);
  await dialog.getByLabel("Telefone com DDD").fill(lead.phone);
  await dialog.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await dragToColumn(page, lead.email, "converted");
}

// Kanban inteiro visível (menu lateral + 7 colunas): o arraste de Prospect até Convertido não depende de rolagem
test.use({ viewport: { width: 2600, height: 900 } });

async function openClient(page: Page, email: string) {
  await page.getByTestId(`client-row-${email}`).getByText(email).click();
  await expect(page.getByTestId("client-dialog")).toBeVisible();
}

test.describe("clientes (admin)", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("arrastar o lead para Convertido cria o cliente; lista, contador, edição, atendimento e linha do tempo", async ({ page }) => {
    await page.goto("/clients");
    const before = await activeCount(page);
    await expect(page.getByRole("button", { name: /novo cliente|adicionar cliente/i })).toHaveCount(0);

    await createAndConvertByDrag(page, { name: "Paula Cliente", email: "paula@e2e.test", phone: "11977770000" });

    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Clientes" }).click();
    const row = page.getByTestId("client-row-paula@e2e.test");
    await expect(row).toContainText("Paula Cliente");
    await expect(row).toContainText("(11) 97777-0000");
    await expect(row).toContainText("Adimplente");
    expect(await activeCount(page)).toBe(before + 1);

    // Linha inteira abre Informações; lápis abre Editar
    await openClient(page, "paula@e2e.test");
    await expect(page.getByRole("tab", { name: "Informações", selected: true })).toBeVisible();
    await page.getByTestId("client-dialog").getByRole("button", { name: "Fechar" }).click();
    await row.getByRole("button", { name: "Editar Paula Cliente" }).click();
    await expect(page.getByRole("tab", { name: "Editar", selected: true })).toBeVisible();

    // Editar status → contador cai
    await page.getByLabel("Status associativo").selectOption("inadimplente");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();

    // Atendimento
    await page.getByRole("tab", { name: /Atendimentos/ }).click();
    await page.getByLabel("Tipo").selectOption("call");
    await page.getByLabel("Assunto").fill("Cobrança da mensalidade");
    await page.getByRole("button", { name: "Registrar atendimento" }).click();
    await expect(page.getByTestId("service-record").first()).toContainText("Cobrança da mensalidade");
    await expect(page.getByTestId("service-record").first()).toContainText("Ligação");

    // Linha do tempo com o histórico completo
    await page.getByRole("tab", { name: "Linha do tempo" }).click();
    const timeline = page.getByTestId("timeline");
    await expect(timeline).toContainText("Virou lead em Prospect");
    await expect(timeline).toContainText("Movido de Prospect para Convertido");
    await expect(timeline).toContainText("Convertido em cliente");
    await expect(timeline).toContainText("Status associativo: Adimplente → Inadimplente");
    await expect(timeline).toContainText("Atendimento (Ligação): Cobrança da mensalidade");
    await expect(timeline.getByTestId("timeline-item").first()).toContainText(/\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);

    // Editar e excluir o atendimento
    await page.getByRole("tab", { name: /Atendimentos/ }).click();
    const item = page.getByTestId("service-record").first();
    await item.getByRole("button", { name: "Editar atendimento Cobrança da mensalidade" }).click();
    const editForm = page.getByTestId("service-record-edit-form");
    await editForm.getByLabel("Assunto").fill("Cobrança renegociada");
    await editForm.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(item).toContainText("Cobrança renegociada");
    await expect(item).toContainText(/Editado em \d{2}\/\d{2}\/\d{4}/);
    await item.getByRole("button", { name: "Excluir atendimento Cobrança renegociada" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByTestId("service-record")).toHaveCount(0);
    await page.getByRole("tab", { name: "Linha do tempo" }).click();
    await expect(page.getByTestId("timeline")).toContainText("Atendimento editado: Cobrança renegociada");
    await expect(page.getByTestId("timeline")).toContainText("Atendimento excluído: Ligação — Cobrança renegociada");

    await page.getByTestId("client-dialog").getByRole("button", { name: "Fechar" }).click();
    expect(await activeCount(page)).toBe(before);
  });

  test("desfazer a conversão arquiva o cliente; excluir o lead convertido é bloqueado", async ({ page }) => {
    await createAndConvertByDrag(page, { name: "Rafael Reverte", email: "rafael@e2e.test", phone: "11966660000" });

    // Excluir bloqueado
    await page.getByTestId("lead-card-rafael@e2e.test").click();
    await page.getByRole("tab", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Excluir" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir definitivamente" }).click();
    await expect(page.getByText("Este lead já virou cliente e não pode ser excluído.", { exact: false })).toBeVisible();

    // Status não se edita no formulário; desfazer a conversão é arrastando o card
    await expect(page.getByLabel("Status")).toHaveValue("Convertido");
    await expect(page.getByLabel("Status")).toBeDisabled();
    await page.getByRole("dialog").getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await dragToColumn(page, "rafael@e2e.test", "not_converted");

    await page.goto("/clients");
    await expect(page.getByTestId("client-row-rafael@e2e.test")).toHaveCount(0);
    await page.getByRole("link", { name: "Arquivados" }).click();
    await openClient(page, "rafael@e2e.test");
    await page.getByRole("tab", { name: "Linha do tempo" }).click();
    await expect(page.getByTestId("timeline")).toContainText("Conversão desfeita — cliente arquivado");
    await page.getByRole("tab", { name: /Atendimentos/ }).click();
    await expect(page.getByTestId("service-record-form")).toHaveCount(0);
  });
});

test.describe("clientes (viewer)", () => {
  test.use({ storageState: storageStatePath("viewer") });

  test("vê clientes, mas não edita nem registra atendimento", async ({ page, browser }) => {
    // Garante um cliente convertido pelo admin
    const admin = await browser.newContext({ storageState: storageStatePath("admin") });
    const adminPage = await admin.newPage();
    await createAndConvertByDrag(adminPage, { name: "Sara Leitura", email: "sara@e2e.test", phone: "11955550000" });
    await admin.close();

    await page.goto("/clients");
    await openClient(page, "sara@e2e.test");
    await page.getByRole("tab", { name: "Editar" }).click();
    await expect(page.getByLabel("Nome", { exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: /Atendimentos/ }).click();
    await expect(page.getByTestId("service-record-form")).toHaveCount(0);
    await expect(page.getByText(ADMIN_LEAD.name)).toHaveCount(0);
  });
});
