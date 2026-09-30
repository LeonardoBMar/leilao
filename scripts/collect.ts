// Coletor de anúncios (docs/PLANO-COLETA.md, D-26). Uso: `npm run collect` (local) ou o workflow agendado
// `.github/workflows/collect.yml`. Precisa só de DATABASE_URL. Roda sem usuário: grava o catálogo global,
// o lance dos lotes ligados a anúncios (D-34) e os alertas (D-32).
//
// Opções: --max-visits <n> (padrão 400) limita as páginas de anúncio baixadas nesta execução.

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { runCollector } = await import("@/server/collector/run");
  const { leiloSource } = await import("@/sources/leilo");

  const maxVisits = readNumberFlag("--max-visits") ?? 400;
  const summary = await runCollector({ source: leiloSource, maxVisits });

  process.stdout.write(
    `Coleta ${summary.sourceId}: ${summary.status} · ${summary.requests} requisições · ` +
      `${summary.discovered} no sitemap · ${summary.created} novos · ${summary.updated} atualizados · ` +
      `${summary.failed} falhas · ${summary.lotsUpdated} lotes com lance novo · ${summary.alertsCreated} alertas\n`,
  );
  for (const { url, error } of summary.errors) process.stdout.write(`  falha: ${url} → ${error}\n`);
  if (summary.status === "failed") process.exitCode = 1;
}

function readNumberFlag(name: string): number | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  // O cliente do banco mantém conexões abertas; encerra quando a execução termina.
  .finally(() => setTimeout(() => process.exit(), 100).unref());
