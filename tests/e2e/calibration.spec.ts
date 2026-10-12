import { expect, test } from "@playwright/test";

import { section } from "./helpers";

/**
 * Calibração (docs/PLANO-MERCADO.md §7): o limite das análises fixadas antes do desfecho frente ao arremate. Não
 * depende de o usuário ter resultados: sem nenhum, a tela diz como chegar lá.
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

test("mostra a tabela por análise ou explica como ter resultados", async ({ page }) => {
  await page.goto("/mercado/calibracao");
  await expect(page.getByRole("heading", { name: "Mercado", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Calibração" })).toHaveAttribute("aria-current", "page");
  const empty = page.getByText("Nenhum resultado para calibrar ainda");
  await expect(section(page, "Por análise").or(empty)).toBeVisible();
  if ((await empty.count()) > 0) return;
  // Cada linha leva ao lote; a faixa nunca usa vendas posteriores à fixação.
  await expect(section(page, "Por análise").getByRole("link").first()).toHaveAttribute("href", /^\/lotes\//);
  await expect(page.getByText(/só com vendas encerradas antes dela/)).toBeVisible();
});
