import { expect, test as setup } from "@playwright/test";

import { AUTH_STATE } from "../../playwright.config";

/**
 * Login único do usuário de testes; a sessão é salva e reaproveitada pelo projeto "authenticated".
 * Credenciais em `.env.local` (E2E_EMAIL/E2E_PASSWORD), de um usuário dedicado a testes.
 */
setup("login do usuário de testes", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  setup.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD no .env.local para rodar os testes autenticados.");

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email ?? "");
  await page.getByLabel("Senha").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: AUTH_STATE });
});
