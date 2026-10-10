import { expect, test } from "@playwright/test";

/**
 * "Adicionar à análise" (docs/PLANO-COLETA.md, etapa 3): um clique leva o anúncio ao Tracker como leilão, lote e
 * rascunho preenchido, sem sair do catálogo e sem duplicar. O que vem de cada campo está em src/domain/listings/tracker.test.ts; a
 * atualização do lance pelo coletor, em shouldSyncBid.
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

/** Encerrados de qualquer distância: há sempre muitos no catálogo, e o teste não depende do dia. */
const CATALOG = "/leiloes/veiculos?situacao=encerrados&distancia=todas";

test("adiciona um anúncio à análise, não duplica e leva ao lote acompanhado", async ({ page }) => {
  await page.goto(CATALOG);
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("button", { name: "Adicionar à análise" }) })
    .first();
  test.skip((await card.count()) === 0, "Catálogo sem anúncio disponível para adicionar.");
  const sourceLink = await card.getByRole("link", { name: /^Ver lote/ }).getAttribute("href");

  const same = page.getByRole("article").filter({ has: page.locator(`a[href="${sourceLink}"]`) });
  await card.getByRole("button", { name: "Adicionar à análise" }).click();

  // Continua no catálogo: o cartão passa a levar ao lote e o toast abre o rascunho.
  await expect(same.getByRole("link", { name: "Ver minha análise" })).toBeVisible();
  await expect(same.getByRole("button", { name: "Adicionar à análise" })).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir análise" }).click();
  await expect(page).toHaveURL(/\/analise\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Análise financeira v1", level: 1 })).toBeVisible();
  await expect(page.locator("textarea[name=notes]")).toHaveValue(/^Premissas padrão, pessimistas/);

  await page.goto(CATALOG);
  await same.getByRole("link", { name: "Ver minha análise" }).click();
  await expect(page).toHaveURL(/\/lotes\/[0-9a-f-]+$/);
  await expect(page.getByText(/Acompanhado no /)).toBeVisible();
  // Etapa 4: a ficha diz de onde virá o resultado. O estado depende do anúncio escolhido (ainda revisitado, desfecho
  // definitivo, a confirmar ou já gravado); cada um tem teste em src/domain/listings/outcome.test.ts.
  await expect(
    page.getByText(/registrado sozinho|já informou o desfecho|Resultado a confirmar|Registrado pelo coletor/).first(),
  ).toBeVisible();

  // Limpeza: o lote só tem rascunho, então pode ser excluído.
  await page.getByRole("button", { name: "Mais ações do lote" }).click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page).toHaveURL(/\/leiloes\/[0-9a-f-]+$/);
  // O leilão veio junto; sai também se ficou vazio (outro teste pode ter lote no mesmo leilão da fonte).
  const empty = page.getByText("Nenhum lote cadastrado");
  await expect(empty.or(page.getByRole("table"))).toBeVisible();
  if (await empty.isVisible()) {
    await page.getByRole("button", { name: "Excluir" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir definitivamente" }).click();
    await expect(page).toHaveURL(/\/minhas-analises\?vista=leilao$/);
  }
});
