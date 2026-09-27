import { expect, test } from "@playwright/test";

/**
 * "Descobertos" (docs/PLANO-COLETA.md, etapa 1): lotes do catálogo coletado, filtros pela URL
 * e a saúde da coleta. Não depende de quantos lotes o coletor já trouxe.
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

test("mostra a saúde da coleta e os lotes descobertos (ou o estado vazio)", async ({ page }) => {
  await page.goto("/descobertos");
  await expect(page.getByRole("heading", { name: "Descobertos", level: 1 })).toBeVisible();
  await expect(page.getByText(/lotes abertos até 150 km de São Carlos\/SP/)).toBeVisible();
  await expect(page.getByRole("search", { name: "Filtrar lotes descobertos" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Lotes descobertos" })
      .or(page.getByText(/Nenhum lote (aberto|encerrado) encontrado/)),
  ).toBeVisible();
});

test("filtros vão para a URL e sobrevivem ao recarregar", async ({ page }) => {
  await page.goto("/descobertos");
  await page.getByLabel("Buscar", { exact: true }).fill("Onix");
  await page.getByLabel("Ano de", { exact: true }).fill("2015");
  await page.getByRole("button", { name: "Filtrar" }).click();

  await expect(page).toHaveURL(/busca=Onix/);
  await expect(page).toHaveURL(/anoDe=2015/);
  await page.reload();
  await expect(page.getByLabel("Buscar", { exact: true })).toHaveValue("Onix");
  await expect(page.getByRole("button", { name: /Limpar filtros \(2\)/ })).toBeVisible();
});

test("o dashboard mostra a linha da coleta e leva a Descobertos", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(/lotes abertos até 150 km/)).toBeVisible();
  await page.getByRole("link", { name: "Ver descobertos" }).click();
  await expect(page).toHaveURL(/\/descobertos$/);
});
