import { expect, test } from "@playwright/test";

import { field } from "./helpers";

/**
 * Monitores e alertas (docs/PLANO-COLETA.md, etapa 2). Alertas nascem na coleta (D-32), então aqui só a tela
 * é conferida; a regra de quais lotes viram alerta está em src/domain/listings/alerts.test.ts.
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

test("navegação tem Alertas e Monitores, e Alertas abre sem erro", async ({ page }) => {
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Principal" }).first();
  await expect(nav.getByRole("link", { name: /^Alertas/ })).toBeVisible();
  await nav.getByRole("link", { name: /^Monitores/ }).click();
  await expect(page.getByRole("heading", { name: "Monitores", level: 1 })).toBeVisible();

  await page.goto("/alertas");
  await expect(page.getByRole("heading", { name: "Alertas", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Alertas" }).or(page.getByText(/Nenhum alerta (não lido|ainda)/)),
  ).toBeVisible();
});

test("monitor exige ao menos um critério de veículo e valida a faixa de ano", async ({ page }) => {
  await page.goto("/monitores/novo");
  await page.getByRole("button", { name: "Criar monitor" }).click();
  await expect(
    page.getByText("Informe marca ou modelo, um ano, uma faixa de preço ou um teto do valor de mercado."),
  ).toBeVisible();

  await field(page, "Ano de").fill("2015");
  await field(page, "Ano até").fill("2010");
  await page.getByRole("button", { name: "Criar monitor" }).click();
  await expect(page.getByText("O ano final deve ser igual ou maior que o inicial.")).toBeVisible();
});

test("cria, edita, desliga e exclui um monitor", async ({ page }) => {
  const search = `E2E Monitor ${Date.now()}`;

  await page.goto("/monitores/novo");
  await field(page, "Marca, modelo ou versão").fill(search);
  await field(page, "Ano de").fill("2011");
  await field(page, "Ano até").fill("2013");
  await page.getByRole("radio", { name: "Até pequena", exact: true }).click();
  await page.getByRole("button", { name: "Criar monitor" }).click();

  await expect(page).toHaveURL(/\/monitores$/);
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: search }) });
  await expect(card).toBeVisible();
  await expect(card.getByText(/2011–2013 · até 150 km · até pequena monta/)).toBeVisible();
  await expect(card.getByText("Ligado")).toBeVisible();
  // Nome inventado não combina com nenhum lote; o link leva a "Todos os veículos" com os mesmos critérios.
  await expect(card.getByRole("link", { name: "0 lotes abertos combinam agora" })).toHaveAttribute(
    "href",
    /\/leiloes\/veiculos\?.*anoDe=2011.*condicao=ate-pequena/,
  );

  await card.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Editar monitor", level: 1 })).toBeVisible();
  // Por papel, não por rótulo: o formulário de "Novo monitor" continua montado e escondido (<Activity>),
  // e getByLabel também encontra campos escondidos.
  const editForm = (name: string) => page.getByRole("textbox", { name, exact: true });
  await expect(editForm("Marca, modelo ou versão")).toHaveValue(search);
  await editForm("Nome do monitor").fill(`${search} renomeado`);
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page).toHaveURL(/\/monitores$/);
  const renamed = page.getByRole("article").filter({ has: page.getByRole("heading", { name: `${search} renomeado` }) });
  await renamed.getByRole("button", { name: "Desligar" }).click();
  await expect(renamed.getByText("Desligado")).toBeVisible();

  await renamed.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir monitor" }).click();
  await expect(renamed).toHaveCount(0);
});
