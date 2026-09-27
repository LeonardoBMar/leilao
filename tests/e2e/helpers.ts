import { expect, type Locator, type Page } from "@playwright/test";

/** `R$ 33.200,00` como o Intl formata (espaço não separável depois de "R$"). */
export const brl = (value: string) => new RegExp(`R\\$\\s${value.replace(/\./g, "\\.")}`);

/**
 * Campo pelo rótulo exato. O `*` de obrigatório fica dentro do <label> (aria-hidden), e `getByLabel` com
 * `exact` compara o texto inteiro ("Nome do leilão *"); por isso o asterisco é aceito como sufixo opcional.
 */
export function field(scope: Page | Locator, label: string): Locator {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return scope.getByLabel(new RegExp(`^${escaped}\\s*\\*?$`));
}

/** Select do Radix: abre pelo rótulo e escolhe a opção pelo texto. */
export async function choose(page: Page, label: string, option: string) {
  await field(page, label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** Preenche vários campos pelo rótulo exato. */
export async function fillFields(page: Page, fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    await field(page, label).fill(value);
  }
}

/** Id do registro a partir da URL atual (`/lotes/<id>`, `/analise/<id>`…). */
export function idFromUrl(page: Page, prefix: string): string {
  const match = new RegExp(`${prefix}/([0-9a-f-]{36})`).exec(page.url());
  if (!match?.[1]) throw new Error(`URL sem id após ${prefix}: ${page.url()}`);
  return match[1];
}

/** Login pela tela, como o usuário faz. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}

export function section(page: Page, name: string): Locator {
  return page.getByRole("region", { name });
}

/** PNG 1×1 válido e um PDF disfarçado de JPEG (CA-18). */
export const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
export const FAKE_JPEG = Buffer.from("%PDF-1.7\n% não é uma imagem\n");
