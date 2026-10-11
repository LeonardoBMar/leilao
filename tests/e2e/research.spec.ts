import { expect, type Page, test } from "@playwright/test";

import { section } from "./helpers";

/**
 * "Pesquisa" (D-45, D-46, docs/PLANO-PESQUISA.md): gráficos dos preços de arremate do catálogo, com os filtros pela
 * URL. Não depende de quantas vendas o coletor já trouxe: sem venda, cada bloco mostra o estado vazio.
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

const NO_SALES = /Nenhuma venda com esses filtros/;

/** Links dos estados com venda no mapa. */
function mapStates(page: Page) {
  return page.getByRole("group", { name: /^Mapa do Brasil/ }).getByRole("link");
}

test("mostra o tamanho da base e os blocos (ou o estado vazio)", async ({ page }) => {
  await page.goto("/mercado/panorama");
  await expect(page.getByRole("heading", { name: "Mercado", level: 1 })).toBeVisible();
  await expect(page.getByText(/[\d.]+ vendas? arrematadas no catálogo desde \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /com esses filtros/ })).toBeVisible();

  for (const title of ["De quem se compra", "Quanto se paga por condição", "Onde", "Modelos", "Como o lance sobe"]) {
    await expect(section(page, title)).toBeVisible();
  }
  // Cada gráfico tem a tabela equivalente, ou o bloco diz que não há venda.
  const condition = section(page, "Quanto se paga por condição");
  await expect(condition.getByText("Ver dados em tabela").or(condition.getByText(NO_SALES))).toBeVisible();
});

/** Abre o mapa do bloco "Onde", que fica recolhido sem estado escolhido. */
async function openMap(page: Page) {
  const block = section(page, "Onde");
  await block.getByText("Ver no mapa").click();
  return block;
}

test("clicar num estado mostra o detalhe dele frente ao Brasil, e o chip volta ao país todo", async ({ page }) => {
  await page.goto("/mercado/panorama");
  await expect(section(page, "Onde")).toBeVisible();
  test.skip((await section(page, "Onde").getByText(NO_SALES).count()) > 0, "Nenhuma venda.");
  const block = await openMap(page);
  await expect(block.getByRole("group", { name: /^Mapa do Brasil/ })).toBeVisible();
  const state = mapStates(page).first();
  test.skip((await state.count()) === 0, "Nenhum estado com venda.");

  const name = (await state.getAttribute("aria-label"))?.split(":")[0] ?? "";
  await state.click();
  await expect(page).toHaveURL(/[?&]uf=[A-Z]{2}/);
  // Com estado escolhido, o mapa já abre.
  await expect(block.getByRole("heading", { name, level: 3 })).toBeVisible();
  await expect(mapStates(page).and(page.locator('[aria-current="true"]'))).toHaveCount(1);

  await page
    .getByRole("list", { name: "Filtros ativos" })
    .getByRole("button", { name: `Remover filtro ${name}` })
    .click();
  await expect(page).not.toHaveURL(/uf=/);
  // Sem estado, o mapa volta a ficar recolhido.
  await openMap(page);
  await expect(block.getByText(/Escolha um estado no mapa/)).toBeVisible();
});

test("escolher um modelo troca o ranking pelas vendas do modelo e libera o mapa em R$", async ({ page }) => {
  await page.goto("/mercado/panorama");
  const picker = page.getByRole("combobox", { name: "Modelo" });
  await picker.click();
  const option = page.getByRole("listbox", { name: "Modelos" }).getByRole("option").first();
  test.skip((await option.count()) === 0, "Nenhum modelo com venda.");
  await option.click();

  await expect(page).toHaveURL(/[?&]marca=.+&modelo=/);
  const label = await picker.inputValue();
  await expect(section(page, `Vendas do ${label}`)).toBeVisible();
  await expect(section(page, "Modelos")).toHaveCount(0);

  const metric = page.getByRole("navigation", { name: "Medida do mapa" });
  await metric.getByRole("link", { name: "Lance em R$" }).click();
  await expect(page).toHaveURL(/medida=price/);
  if ((await section(page, "Onde").getByText(NO_SALES).count()) === 0) {
    await openMap(page);
    await expect(page.getByText("em milhares de R$")).toBeVisible();
  }

  // Os filtros sobrevivem ao recarregar.
  await page.reload();
  await expect(picker).toHaveValue(label);
  await expect(metric.getByRole("link", { name: "Lance em R$" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Ver todos os modelos" }).click();
  await expect(page).not.toHaveURL(/modelo=/);
  await expect(section(page, "Modelos")).toBeVisible();
});

/** Abre a gaveta "Mais filtros" (condição, estado, fonte, km e ano). */
async function openMoreFilters(page: Page) {
  await page.getByRole("button", { name: /^Mais filtros/ }).click();
  return page.getByRole("dialog", { name: "Mais filtros" });
}

test("a condição muda pela gaveta, vai para a URL e vira chip", async ({ page }) => {
  await page.goto("/mercado/panorama");
  const drawer = await openMoreFilters(page);
  const select = drawer.getByRole("combobox", { name: "Condição" });
  await select.click();
  // A primeira condição com venda além do padrão (condição sem venda fica desabilitada).
  const others = { "Pequena monta": "pequena", "Média monta": "media", "Grande monta": "grande", Sucata: "sucata" };
  const choice = await (async () => {
    for (const [label, key] of Object.entries(others)) {
      const option = page.getByRole("option", { name: new RegExp(`^${label}`), disabled: false });
      if ((await option.count()) > 0) return { label, key, option };
    }
    return null;
  })();
  test.skip(choice === null, "Nenhuma venda fora de “sem monta declarada”.");
  if (choice === null) return;
  await choice.option.click();
  await expect(page).toHaveURL(new RegExp(`condicao=${choice.key}`));
  await expect(select).toHaveText(new RegExp(choice.label));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Mais filtros (1)" })).toBeVisible();
  await page
    .getByRole("list", { name: "Filtros ativos" })
    .getByRole("button", { name: `Remover filtro ${choice.label}` })
    .click();
  await expect(page).not.toHaveURL(/condicao=/);
});

test("filtro inválido na URL cai no padrão, sem erro", async ({ page }) => {
  await page.goto("/mercado?condicao=xyz&categoria=barcos&uf=ZZ&medida=price");
  await expect(page.getByRole("heading", { name: "Mercado", level: 1 })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Categoria" })).toHaveText(/Carros/);
  await expect(page.getByRole("button", { name: /^Remover filtro/ })).toHaveCount(0);
  const drawer = await openMoreFilters(page);
  await expect(drawer.getByRole("combobox", { name: "Condição" })).toHaveText(/Sem monta declarada/);
  // Sem modelo, a medida é sempre o % do mercado.
  await expect(page.getByRole("navigation", { name: "Medida do mapa" })).toHaveCount(0);
});
