import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

/** Sem sessão: o proxy redireciona e o login não aceita destinos externos (SPEC §11, CA-15). */
test.describe("acesso sem sessão", () => {
  test("a raiz leva ao login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("rotas privadas levam ao login preservando o destino", async ({ page }) => {
    for (const path of ["/dashboard", "/leiloes", "/minhas-analises", "/mercado", "/minhas-analises/leiloes/novo"]) {
      await page.goto(path);
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    }
    await expect(page.getByText("Sua sessão expirou ou é preciso entrar para continuar.")).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue("/minhas-analises/leiloes/novo");
  });

  test("o destino após o login nunca aponta para outro site (open redirect)", async ({ page }) => {
    for (const next of ["https://evil.example/", "//evil.example", "/\\evil.example"]) {
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
    }
  });

  test("dados privados não aparecem sem sessão", async ({ page }) => {
    const response = await page.goto("/lotes/00000000-0000-7000-8000-000000000001");
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Lote")).toHaveCount(0);
  });
});

test.describe("produção", () => {
  test("robots.txt responde sem sessão e bloqueia indexação", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(/Disallow: \//);
  });

  test("cabeçalhos de segurança e CSP", async ({ request }) => {
    const headers = (await request.get("/login")).headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("a página de login funciona sob a CSP, sem violações", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
    });
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    expect(violations).toEqual([]);
  });
});

test.describe("tela de login", () => {
  test("a casca estática aparece de imediato (Cache Components)", async ({ page, baseURL }) => {
    await instant(
      page,
      async () => {
        await page.goto("/login");
        await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
        await expect(page.getByText("Acesse com a conta autorizada.")).toBeVisible();
      },
      { baseURL },
    );
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

  test("campos acessíveis por rótulo", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Senha")).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
});
