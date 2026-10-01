import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "../../playwright.config";
import {
  brl,
  choose,
  expectToast,
  FAKE_JPEG,
  field,
  fillFields,
  idFromUrl,
  section,
  signIn,
  VALID_PNG,
} from "./helpers";

/**
 * Fluxo completo do SPEC §13: login → leilão → lote → análise fixada → resultado → dashboard, conferindo os
 * critérios de aceite pela interface. Cria dados reais no usuário de testes; ao final o leilão é arquivado.
 */
test.describe.configure({ mode: "serial" });
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const auctionName = `E2E ${stamp}`;
let auctionId = "";
let lotId = "";

test("cadastra um leilão", async ({ page }) => {
  await page.goto("/leiloes/novo");
  await fillFields(page, {
    "Nome do leilão": auctionName,
    Organizador: "Leiloeiro E2E",
    "Data e hora": "2030-10-02T10:00",
  });
  await choose(page, "Origem", "Detran");
  await page.getByRole("button", { name: "Cadastrar leilão" }).click();

  await expect(page.getByRole("heading", { name: auctionName })).toBeVisible();
  auctionId = idFromUrl(page, "/leiloes");
});

test("cadastra um lote e bloqueia número repetido no mesmo leilão (CA-02)", async ({ page }) => {
  const lotForm = { "Número do lote": "0152", Marca: "Toyota", Modelo: "Corolla", "Ano-modelo": "2020" };

  await page.goto(`/leiloes/${auctionId}/lotes/novo`);
  await fillFields(page, { ...lotForm, "Lance atual": "31.000" });
  await page.getByRole("button", { name: "Cadastrar lote" }).click();
  await expect(page.getByRole("heading", { name: "Toyota Corolla 2020" })).toBeVisible();
  lotId = idFromUrl(page, "/lotes");

  await page.goto(`/leiloes/${auctionId}/lotes/novo`);
  await fillFields(page, lotForm);
  await page.getByRole("button", { name: "Cadastrar lote" }).click();
  await expect(page.getByText("Já existe um lote com este número neste leilão.")).toBeVisible();
});

test("análise: exemplos do SPEC, pendências e fixação (CA-03, CA-04, CA-05, CA-07)", async ({ page }) => {
  await page.goto(`/lotes/${lotId}`);
  await page.getByRole("button", { name: "Analisar lote" }).click();
  await expect(page.getByRole("heading", { name: "Análise financeira v1" })).toBeVisible();
  // D-38: o rascunho nasce com as premissas padrão (lote sem anúncio: custos fixos, reserva e margem em %).
  await expect(field(page, "Pneus")).toHaveValue("2400,00");
  await expect(field(page, "Margem desejada (%)")).toHaveValue("15");

  // Reserva 4% e margem 12% de R$ 50.000 = R$ 2.000 e R$ 6.000, os valores do SPEC.
  await fillFields(page, {
    "Valor de venda esperado": "50.000",
    Reparos: "5.000",
    Documentação: "1.000",
    "Transporte/guincho": "800",
    Pneus: "0",
    Revisão: "0",
    "Outras taxas fixas": "0",
    "Reserva para imprevistos (%)": "4",
    "Margem desejada (%)": "12",
  });
  await page.getByRole("radio", { name: "Valor fixo" }).click();
  await field(page, "Comissão fixa").fill("2.000");

  // CA-03: limite R$ 33.200,00; lance simulado R$ 31.000,00 (lance atual) → custo R$ 41.800,00, margem R$ 8.200,00.
  await expect(section(page, "Lance máximo")).toContainText(brl("33.200,00"));
  const simulation = section(page, "Simulação de lance");
  await expect(simulation).toContainText(brl("41.800,00"));
  await expect(simulation).toContainText(brl("8.200,00"));
  await expect(simulation).toContainText("Abaixo do seu limite");

  // CA-05: no limite e acima, sem divergência de centavos.
  await simulation.getByLabel("Lance simulado").fill("33.200,00");
  await expect(simulation).toContainText("No seu limite");
  await simulation.getByLabel("Lance simulado").fill("33.200,01");
  await expect(simulation).toContainText("Acima do seu limite");

  // CA-04: 5% sobre o lance → R$ 33.523,81.
  await page.getByRole("radio", { name: "Percentual sobre o lance" }).click();
  await page.getByLabel("Taxa de comissão (%)").fill("5");
  await expect(section(page, "Lance máximo")).toContainText(brl("33.523,81"));

  // CA-07: fixar com campo vazio salva o rascunho e aponta a pendência.
  await field(page, "Pneus").fill("");
  await page.getByRole("button", { name: "Fixar análise" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fixar análise" }).click();
  await expect(page.getByText("Para fixar, preencha os campos pendentes.")).toBeVisible();
  await expect(page.getByText("Obrigatório para fixar.")).toBeVisible();

  // Volta à comissão fixa (limite R$ 33.200,00, usado no resultado) e fixa.
  await field(page, "Pneus").fill("0");
  await page.getByRole("radio", { name: "Valor fixo" }).click();
  await field(page, "Comissão fixa").fill("2.000");
  await expect(section(page, "Lance máximo")).toContainText(brl("33.200,00"));
  await page.getByRole("button", { name: "Fixar análise" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fixar análise" }).click();

  // Fixada: a tela troca o editor pela versão em leitura (o aviso some junto com o editor).
  await expect(page.getByText(/^Fixada em /)).toBeVisible();
  await expect(page.getByText("Fixada", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar nova versão" })).toBeVisible();
});

test("revisar premissas cria nova versão e preserva a fixada (CA-08)", async ({ page }) => {
  await page.goto(`/lotes/${lotId}`);
  await page.getByRole("button", { name: "Revisar premissas" }).click();
  await expect(page.getByRole("heading", { name: "Análise financeira v2" })).toBeVisible();
  // Premissas copiadas da v1.
  await expect(field(page, "Valor de venda esperado")).toHaveValue("50000,00");
  await expect(page.getByRole("link", { name: "v1" })).toBeVisible();

  // Descarta o rascunho: a v1 continua intacta.
  await page.getByRole("button", { name: "Descartar rascunho" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Descartar" }).click();
  await expect(page).toHaveURL(`/lotes/${lotId}`);
  await expect(page.getByText(brl("33.200,00")).first()).toBeVisible();
});

test("resultado acima do limite e correção preservando a revisão anterior (CA-10, CA-11, CA-14)", async ({ page }) => {
  await page.goto(`/lotes/${lotId}/resultado`);
  await choose(page, "Desfecho", "Arrematado");
  await fillFields(page, { "Preço final": "35.500", "Data e hora do desfecho": "2030-10-02T15:00" });
  await page.getByRole("button", { name: "Registrar resultado" }).click();

  await expect(page).toHaveURL(`/lotes/${lotId}`);
  await expect(page.getByText(/Preço final R\$\s2\.300,00 acima do seu limite\./)).toBeVisible();
  await expect(page.getByText("Análise anterior ao resultado")).toBeVisible();

  await page.getByRole("link", { name: "Corrigir resultado" }).click();
  await field(page, "Preço final").fill("33.000");
  await page.getByRole("button", { name: "Salvar correção" }).click();
  await expect(page.getByText("Informe o motivo da correção.")).toBeVisible();
  await page.getByLabel("Motivo da correção").fill("Preço conferido no site do leiloeiro");
  await page.getByRole("button", { name: "Salvar correção" }).click();

  await expect(page).toHaveURL(`/lotes/${lotId}`);
  await expect(page.getByText(/Preço final R\$\s200,00 abaixo do seu limite\./)).toBeVisible();
  await expect(page.getByText("Dentro do limite")).toBeVisible();
  await expect(page.getByText("Histórico de correções (1)")).toBeVisible();
});

test("nova versão depois do resultado não muda a comparação vinculada (CA-09)", async ({ page }) => {
  await page.goto(`/lotes/${lotId}`);
  await page.getByRole("button", { name: "Revisar premissas" }).click();
  await expect(page.getByRole("heading", { name: "Análise financeira v2" })).toBeVisible();
  // Criada com resultado já registrado: retrospectiva (SPEC §10).
  await expect(page.getByText("Retrospectiva", { exact: true }).first()).toBeVisible();

  // Limite novo bem diferente: reserva e margem em % acompanham a venda (2.400 e 7.200) → R$ 41.600,00.
  await field(page, "Valor de venda esperado").fill("60.000");
  await expect(section(page, "Lance máximo")).toContainText(brl("41.600,00"));
  await page.getByRole("button", { name: "Fixar análise" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fixar análise" }).click();
  await expect(page.getByText(/^Fixada em /)).toBeVisible();

  // O resultado continua comparado com a v1 (R$ 33.200,00), não com a v2.
  await page.goto(`/lotes/${lotId}`);
  await expect(page.getByRole("link", { name: /33\.200,00 · v1/ })).toBeVisible();
  await expect(page.getByText(/Preço final R\$\s200,00 abaixo do seu limite\./)).toBeVisible();
});

test("duas fixações simultâneas do mesmo rascunho: só uma vale (CA-19)", async ({ page, context }) => {
  await page.goto(`/lotes/${lotId}`);
  await page.getByRole("button", { name: "Revisar premissas" }).click();
  await expect(page.getByRole("heading", { name: "Análise financeira v3" })).toBeVisible();

  const other = await context.newPage();
  await other.goto(page.url());
  const tabs = [page, other];
  for (const tab of tabs) await tab.getByRole("button", { name: "Fixar análise" }).click();
  await Promise.all(tabs.map((tab) => tab.getByRole("dialog").getByRole("button", { name: "Fixar análise" }).click()));

  const outcomes = await Promise.all(
    tabs.map((tab) =>
      settle(
        () => tab.getByText(/^Fixada em /).isVisible(),
        () => tab.getByText("Esta análise já foi fixada", { exact: false }).isVisible(),
      ),
    ),
  );
  expect(outcomes.sort()).toEqual(["lost", "won"]);

  // Nenhuma versão duplicada: v1, v2 e v3 (cabeçalho + 3 linhas).
  await other.reload();
  await expect(section(other, "Histórico de versões").getByRole("row")).toHaveCount(4);
  await other.close();
});

test("duas correções simultâneas do resultado: só uma revisão nova (CA-19)", async ({ page, context }) => {
  const other = await context.newPage();
  const tabs = [page, other];
  for (const tab of tabs) {
    await tab.goto(`/lotes/${lotId}/resultado`);
    await field(tab, "Preço final").fill("34.000");
    await tab.getByLabel("Motivo da correção").fill("Correção simultânea (E2E)");
  }
  await Promise.all(tabs.map((tab) => tab.getByRole("button", { name: "Salvar correção" }).click()));

  const outcomes = await Promise.all(
    tabs.map((tab) =>
      settle(
        async () => new URL(tab.url()).pathname === `/lotes/${lotId}`,
        () => tab.getByText("O resultado deste lote foi alterado depois", { exact: false }).isVisible(),
      ),
    ),
  );
  expect(outcomes.sort()).toEqual(["lost", "won"]);

  await other.close();
  await page.goto(`/lotes/${lotId}`);
  await expect(page.getByText("Histórico de correções (2)")).toBeVisible();
});

test("fotos: recusa conteúdo que não é imagem e aceita imagem válida (CA-18)", async ({ page }) => {
  await page.goto(`/lotes/${lotId}`);
  const input = page.locator('input[type="file"]');

  await input.setInputFiles({ name: "falsa.jpg", mimeType: "image/jpeg", buffer: FAKE_JPEG });
  await expectToast(page, /não é uma imagem JPEG, PNG ou WebP válida/);

  await input.setInputFiles({ name: "valida.png", mimeType: "image/png", buffer: VALID_PNG });
  await expectToast(page, "Foto adicionada.");
  await expect(page.getByRole("list", { name: "Fotos do lote" }).getByText("Capa")).toBeVisible();
});

test("dashboard mostra o indicador de resultados comparáveis", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(/\d+ de \d+ resultados comparáveis ficaram dentro do limite/)).toBeVisible();
});

test("arquivar lote com histórico: sai das listas e continua acessível (CA-17)", async ({ page }) => {
  const lotLink = page.getByRole("link", { name: "Toyota Corolla 2020" });

  await page.goto(`/lotes/${lotId}`);
  await page.getByRole("button", { name: "Arquivar" }).click();
  await expectToast(page, "Lote arquivado.");
  await expect(page.getByText(/Lote arquivado em/)).toBeVisible();

  await page.goto(`/leiloes/${auctionId}`);
  await expect(page.getByRole("heading", { name: auctionName })).toBeVisible();
  await expect(lotLink).toHaveCount(0);

  await page.goto(`/leiloes/${auctionId}?arquivados=1`);
  await lotLink.click();
  await expect(page.getByRole("heading", { name: "Toyota Corolla 2020" })).toBeVisible();
  await expect(page.getByText("Histórico de correções (2)")).toBeVisible();
});

test("arquiva o leilão de teste (sai das visões ativas)", async ({ page }) => {
  await page.goto(`/leiloes/${auctionId}`);
  await page.getByRole("button", { name: "Arquivar" }).click();
  await expectToast(page, "Leilão arquivado.");

  await page.goto(`/leiloes?busca=${encodeURIComponent(auctionName)}`);
  await expect(page.getByText("Nenhum leilão encontrado")).toBeVisible();
});

test("sair e entrar de novo: dados e vínculos continuam lá (CA-01)", async ({ page, browser, baseURL }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto(`/lotes/${lotId}`);
  await expect(page).toHaveURL(/\/login/);

  // "Sair" encerra só esta sessão: a de outro aparelho (a salva pelo setup) continua valendo.
  const otherDevice = await browser.newContext({ storageState: AUTH_STATE, baseURL });
  const otherPage = await otherDevice.newPage();
  await otherPage.goto("/dashboard");
  await expect(otherPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await otherDevice.close();

  await signIn(page, process.env.E2E_EMAIL ?? "", process.env.E2E_PASSWORD ?? "");
  await page.goto(`/lotes/${lotId}`);
  await expect(page.getByRole("heading", { name: "Toyota Corolla 2020" })).toBeVisible();
  await expect(page.getByRole("link", { name: auctionName })).toBeVisible();
  await expect(page.getByRole("link", { name: /33\.200,00 · v1/ })).toBeVisible();
  await expect(page.getByText("Histórico de correções (2)")).toBeVisible();
  await expect(page.getByRole("list", { name: "Fotos do lote" }).getByText("Capa")).toBeVisible();
});

/** Espera a aba chegar a um dos dois desfechos de uma disputa (CA-19). */
async function settle(won: () => Promise<boolean>, lost: () => Promise<boolean>): Promise<"won" | "lost"> {
  let outcome: "won" | "lost" | undefined;
  await expect
    .poll(async () => {
      if (await won()) outcome = "won";
      else if (await lost()) outcome = "lost";
      return outcome;
    })
    .toBeDefined();
  if (!outcome) throw new Error("Disputa sem desfecho.");
  return outcome;
}
