import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Descobre todos os arquivos `*.int.test.{ts,tsx}` em `src/` para nunca depender de lista fixa. */
function findIntegrationTests(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "generated") results.push(...findIntegrationTests(full));
    } else if (/\.int\.test\.tsx?$/.test(entry.name)) {
      results.push(path.relative(process.cwd(), full).replaceAll("\\", "/"));
    }
  }
  return results.sort();
}

const rawArgs = process.argv.slice(2);
const allowDefaultDb = rawArgs.includes("--unsafe-default-db");
const vitestArgs = rawArgs.filter((arg) => arg !== "--unsafe-default-db");

// Lê antes de carregar `.env.local` para que `DATABASE_URL` local nunca burle a trava.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const isCiWithExplicitDb = process.env.CI === "true" && Boolean(process.env.DATABASE_URL?.trim());

if (!testDatabaseUrl && !isCiWithExplicitDb && !allowDefaultDb) {
  console.error(
    [
      "Erro: testes de integração gravam registros imutáveis (análises fixadas e revisões de resultado).",
      "Defina TEST_DATABASE_URL apontando para um banco de testes dedicado:",
      "  POSIX:      TEST_DATABASE_URL=postgres://... npm run test:int",
      '  PowerShell: $env:TEST_DATABASE_URL="postgres://..."; npm run test:int',
      "Se quiser deliberadamente rodar contra DATABASE_URL / .env.local, passe --unsafe-default-db.",
    ].join("\n"),
  );
  process.exit(1);
}

// Carrega `.env.local` (ex.: NEXT_PUBLIC_SUPABASE_*) sem sobrescrever variáveis já definidas no ambiente.
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) process.loadEnvFile(envLocalPath);

const hasExplicitTestFile = vitestArgs.some((arg) => !arg.startsWith("-") && /\.test\.tsx?$/.test(arg));
const files = hasExplicitTestFile ? [] : findIntegrationTests(path.resolve(process.cwd(), "src"));
if (!hasExplicitTestFile && files.length === 0) {
  console.error("Nenhum arquivo *.int.test.{ts,tsx} encontrado em src/.");
  process.exit(1);
}

const env = {
  ...process.env,
  DB_INT_TESTS: "1",
  ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}),
};

// Executa o binário JS do Vitest diretamente (sem `shell: true`), preservando argumentos com espaço no Windows.
const vitestBin = path.resolve(process.cwd(), "node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [vitestBin, "run", ...files, ...vitestArgs], {
  stdio: "inherit",
  env,
});

process.exit(result.status ?? 1);
