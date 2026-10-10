// Importa a tabela FIPE do mês do dataset fipeX para `fipe_prices` (D-51). A coleta faz isso sozinha quando falta um
// mês; o script serve para a carga inicial ou para refazer um mês.
//
//   npm run db:fipe-import                    meses que faltam, de setembro/2026 até o atual
//   npm run db:fipe-import -- --month 2026-10 refaz esse mês (substitui o que houver)

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { ensureFipeCatalog, importFipeMonth } = await import("@/server/fipe/dataset");

  const monthFlag = readFlag("--month");
  const results = monthFlag
    ? [await importFipeMonth(parseMonth(monthFlag))]
    : await ensureFipeCatalog({ now: new Date(), maxMonths: 24 });

  if (results.length === 0) process.stdout.write("Nenhum mês faltando no catálogo.\n");
  for (const result of results) {
    if (result.kind === "imported") {
      process.stdout.write(`${result.month}: ${result.prices} preços · ${result.requeued} anúncios de volta à fila\n`);
    } else if (result.kind === "unpublished") {
      process.stdout.write(`${result.month}: ainda não publicada no dataset\n`);
    } else {
      process.stdout.write(`${result.month}: falhou → ${result.error}\n`);
      process.exitCode = 1;
    }
  }
}

function parseMonth(text: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) throw new Error("Use --month AAAA-MM (ex.: 2026-10).");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100).unref());
