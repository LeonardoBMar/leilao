import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Mesmas variáveis do app (.env.local), incluindo E2E_EMAIL/E2E_PASSWORD do usuário de testes.
loadEnvConfig(process.cwd());

const PORT = Number(process.env.E2E_PORT ?? 3000);
export const AUTH_STATE = "tests/e2e/.auth/user.json";

/**
 * E2E (SPEC §13). Projetos:
 * - public: sem sessão (redirecionamentos, login, open redirect);
 * - setup: faz login uma vez com o usuário de testes e salva a sessão;
 * - authenticated: fluxo completo e critérios de aceite, reaproveitando a sessão.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e/.report" }]],
  outputDir: "tests/e2e/.results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "public", testMatch: /public\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "authenticated",
      testMatch: /(flow|access|discovered)\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
