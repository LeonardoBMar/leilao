import { expect, type Page, test } from "@playwright/test";

/**
 * Avaliar (D-71, docs/PLANO-MERCADO.md §5): quanto um veículo costuma sair, com o recorte na URL. Não depende de
 * quantas vendas o coletor já trouxe nem de o usuário ter lotes: sem dado, o teste pula o passo.
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

/** Bloco pelo título, que traz a contagem: "Vendas do recorte (25)". */
const region = (page: Page, name: RegExp) => page.getByRole("region", { name });

/** Escolhe o modelo mais vendido na busca; `false` se não há modelo com venda. */
async function pickTopModel(page: Page): Promise<boolean> {
  const picker = page.getByRole("combobox", { name: "Modelo" });
  await picker.click();
  const option = page.getByRole("listbox", { name: "Modelos" }).getByRole("option").first();
  if ((await option.count()) === 0) return false;
  await option.click();
  await expect(page).toHaveURL(/[?&]marca=.+&modelo=/);
  return true;
}

test("sem veículo, a aba Avaliar faz a pergunta e oferece atalhos", async ({ page }) => {
  await page.goto("/mercado");
  await expect(page.getByRole("heading", { name: "Mercado", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Visões do mercado" }).getByRole("link", { name: "Avaliar" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Quanto este veículo costuma sair em leilão?" })).toBeVisible();
});

test("escolher um modelo mostra a resposta e as vendas do recorte", async ({ page }) => {
  await page.goto("/mercado");
  test.skip(!(await pickTopModel(page)), "Nenhum modelo com venda.");
  await expect(page.getByRole("status").filter({ hasText: /no recorte/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Faixa típica de arremate" }).or(page.getByText(/neste recorte/).first()),
  ).toBeVisible();
  await expect(region(page, /^Vendas do recorte/)).toBeVisible();
});

test("tirar uma venda da conta grava na URL e dá para voltar", async ({ page }) => {
  await page.goto("/mercado");
  test.skip(!(await pickTopModel(page)), "Nenhum modelo com venda.");
  const list = region(page, /^Vendas do recorte/);
  await list
    .getByRole("link", { name: /^Tirar da conta/ })
    .first()
    .click();
  await expect(page).toHaveURL(/[?&]fora=[0-9a-f-]{36}/);
  await expect(list.getByText("Fora da conta", { exact: true })).toBeVisible();

  await list.getByRole("link", { name: /^Voltar para a conta/ }).click();
  await expect(page).not.toHaveURL(/fora=/);
  await expect(list.getByText("Fora da conta", { exact: true })).toHaveCount(0);
});

test("abrir pelo lote usa o lote como alvo", async ({ page }) => {
  await page.goto("/mercado");
  const lot = page.getByRole("region", { name: "Seus lotes" }).getByRole("link").first();
  test.skip((await lot.count()) === 0, "Usuário sem lotes.");
  await lot.click();
  await expect(page).toHaveURL(/[?&]lote=[0-9a-f-]{36}/);
  await expect(page.getByText(/^Comparando com o Lote/)).toBeVisible();
  await page.getByRole("button", { name: "Deixar de comparar com o lote" }).click();
  await expect(page).not.toHaveURL(/lote=/);
});

test("lotes abertos do recorte oferecem analisar e abrir o anúncio", async ({ page }) => {
  await page.goto("/mercado");
  test.skip(!(await pickTopModel(page)), "Nenhum modelo com venda.");
  const open = region(page, /^Lotes abertos do recorte/);
  test.skip((await open.count()) === 0, "Nenhum lote aberto do modelo.");
  await expect(open.getByRole("link", { name: /^Anúncio/ }).first()).toBeVisible();
  await expect(
    open
      .getByRole("button", { name: "Adicionar à análise" })
      .or(open.getByRole("link", { name: "Ver minha análise" }))
      .first(),
  ).toBeVisible();
});
