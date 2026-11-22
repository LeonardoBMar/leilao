import { expect, test as setup } from "@playwright/test";

import { AUTH_STATE } from "../../playwright.config";
import { signIn } from "./helpers";

/**
 * Login único do usuário de testes; a sessão é salva e reaproveitada pelo projeto "authenticated".
 * Credenciais em `.env.local` (E2E_EMAIL/E2E_PASSWORD), de um usuário dedicado a testes.
 */
setup("login do usuário de testes", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  setup.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD no .env.local para rodar os testes autenticados.");

  await signIn(page, email ?? "", password ?? "");
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await page.context().storageState({ path: AUTH_STATE });
});
