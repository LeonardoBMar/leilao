import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

/**
 * Navegação instantânea (Cache Components + Partial Prefetching, D-87):
 * garante que a casca estática/loading das rotas privadas aparece de imediato sem bloquear no banco.
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

test.describe("navegação instantânea", () => {
  test("transição do dashboard para Leilões, Minhas análises e Mercado exibe a casca sem bloqueio", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();

    await instant(
      page,
      async () => {
        await page.getByRole("link", { name: "Leilões" }).first().click();
        await page.waitForURL((url) => url.pathname === "/leiloes");
        await expect(page.getByRole("heading", { name: "Leilões" })).toBeVisible();
      },
      { baseURL },
    );

    await instant(
      page,
      async () => {
        await page.getByRole("link", { name: "Minhas análises" }).first().click();
        await page.waitForURL((url) => url.pathname === "/minhas-analises");
        await expect(page.getByRole("heading", { name: "Minhas análises" })).toBeVisible();
      },
      { baseURL },
    );

    await instant(
      page,
      async () => {
        await page.getByRole("link", { name: "Mercado" }).first().click();
        await page.waitForURL((url) => url.pathname === "/mercado");
        await expect(page.getByRole("link", { name: "Calibração" })).toBeVisible();
      },
      { baseURL },
    );

    await instant(
      page,
      async () => {
        await page.getByRole("link", { name: "Calibração" }).click();
        await page.waitForURL((url) => url.pathname === "/mercado/calibracao");
        await expect(page.getByRole("link", { name: "Calibração" })).toHaveAttribute("aria-current", "page");
      },
      { baseURL },
    );
  });
});
