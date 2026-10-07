import { expect, test } from "@playwright/test";

/**
 * "Leilões" (D-42, docs/PLANO-NAVEGACAO.md): o catálogo coletado por leilão e todos os veículos, com os filtros pela
 * URL e a saúde da coleta. Não depende de quantos lotes o coletor já trouxe.
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

test("por leilão: saúde da coleta e cartões de leilão (ou o estado vazio)", async ({ page }) => {
  await page.goto("/leiloes");
  await expect(page.getByRole("heading", { name: "Leilões", level: 1 })).toBeVisible();
  await expect(page.getByText(/veículos abertos até 150 km de São Carlos\/SP/)).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Visões de leilões" });
  await expect(tabs.getByRole("link", { name: "Por leilão" })).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("region", { name: "Leilões" }).or(page.getByText(/Nenhum leilão (aberto|encerrado) encontrado/)),
  ).toBeVisible();
});

test("abre um leilão do catálogo com os lotes dele", async ({ page }) => {
  await page.goto("/leiloes?situacao=encerrados&distancia=todas");
  const card = page.getByRole("region", { name: "Leilões" }).getByRole("link").first();
  test.skip((await card.count()) === 0, "Catálogo sem leilão encerrado.");
  await card.click();

  await expect(page).toHaveURL(/\/leiloes\/[a-z0-9-]+\/[^/?]+\?/);
  await expect(page.getByRole("navigation", { name: "Trilha" }).getByRole("link", { name: "Leilões" })).toBeVisible();
  await expect(page.getByText(/\d+ lotes?/).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Lotes coletados" })).toBeVisible();
});

test("todos os veículos: lotes (ou o estado vazio) e estimativas", async ({ page }) => {
  await page.goto("/leiloes/veiculos");
  await expect(page.getByRole("search", { name: "Filtrar lotes" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Lotes coletados" })
      .or(page.getByText(/Nenhum lote (aberto|encerrado) encontrado/)),
  ).toBeVisible();
  // Etapa 5: lote aberto mostra as estimativas do sistema (valor ou "sem base suficiente"), com o número de casos.
  const firstCard = page.getByRole("article").first();
  if ((await firstCard.count()) > 0) {
    const estimates = firstCard.getByRole("region", { name: "Estimativas do sistema" });
    await expect(estimates.getByText("Provável")).toBeVisible();
    await expect(estimates.getByText("Limite estimado")).toBeVisible();
  }
});

test("filtros vão para a URL, sobrevivem ao recarregar e passam de uma aba para a outra", async ({ page }) => {
  await page.goto("/leiloes/veiculos");
  await page.getByLabel("Buscar", { exact: true }).fill("Onix");
  await page.getByLabel("Ano de", { exact: true }).fill("2015");
  await page.getByRole("button", { name: "Filtrar" }).click();

  await expect(page).toHaveURL(/busca=Onix/);
  await expect(page).toHaveURL(/anoDe=2015/);
  await page.reload();
  await expect(page.getByLabel("Buscar", { exact: true })).toHaveValue("Onix");
  await expect(page.getByRole("button", { name: /Limpar filtros \(2\)/ })).toBeVisible();

  await page.getByRole("navigation", { name: "Visões de leilões" }).getByRole("link", { name: "Por leilão" }).click();
  await expect(page).toHaveURL(/\/leiloes\?.*busca=Onix/);
  await expect(page.getByLabel("Buscar", { exact: true })).toHaveValue("Onix");
});

test("rotas antigas levam às novas, com a busca", async ({ page }) => {
  await page.goto("/descobertos?busca=Onix");
  await expect(page).toHaveURL(/\/leiloes\/veiculos\?busca=Onix$/);
  await page.goto("/lotes");
  await expect(page).toHaveURL(/\/minhas-analises$/);
});

test("o dashboard mostra a linha da coleta e leva a Leilões", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(/veículos abertos até 150 km/)).toBeVisible();
  await page.getByRole("link", { name: "Ver leilões" }).click();
  await expect(page).toHaveURL(/\/leiloes$/);
});
