import { expect, test } from "@playwright/test";

/**
 * Com sessão, ids inexistentes, inválidos ou de outro dono respondem "não encontrado", sem revelar se o registro
 * existe (ARCHITECTURE §6, CA-15/CA-16).
 */
test.skip(!process.env.E2E_EMAIL, "Sem usuário de testes (E2E_EMAIL/E2E_PASSWORD).");

const UNKNOWN = "00000000-0000-7000-8000-000000000001";

for (const path of [
  `/minhas-analises/leiloes/${UNKNOWN}`,
  // Rota antiga: redireciona para a nova e responde do mesmo jeito (D-42).
  `/leiloes/${UNKNOWN}`,
  "/leiloes/leilo/leilao-que-nao-existe",
  "/leiloes/fonte%20invalida/1",
  `/lotes/${UNKNOWN}`,
  `/lotes/${UNKNOWN}/resultado`,
  `/analise/${UNKNOWN}`,
  "/lotes/nao-e-um-uuid",
]) {
  test(`não encontrado: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });
}
