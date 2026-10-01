// Coletor de anúncios (docs/PLANO-COLETA.md, D-26, D-37). Uso: `npm run collect` (local) ou o workflow agendado
// `.github/workflows/collect.yml`. Precisa só de DATABASE_URL. Roda sem usuário: grava o catálogo global de todas as
// fontes de src/sources/index.ts, o lance e o resultado dos lotes ligados a anúncios (D-34, D-35) e os alertas (D-32).
//
// Opções: --max-visits <n> (padrão 400) limita os anúncios lidos por fonte nesta execução;
// --source <id> coleta só uma fonte (ex.: para testar um adaptador novo).

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { runCollection } = await import("@/server/collector/run");
  const { SOURCES } = await import("@/sources");

  const only = readFlag("--source");
  const sources = only ? SOURCES.filter((source) => source.id === only) : SOURCES;
  if (sources.length === 0)
    throw new Error(`Fonte "${only}" não existe. Fontes: ${SOURCES.map((s) => s.id).join(", ")}.`);

  const maxVisits = readNumberFlag("--max-visits") ?? 400;
  const summary = await runCollection({ sources, maxVisits });

  for (const run of summary.sources) {
    process.stdout.write(
      `Coleta ${run.sourceId}: ${run.status} · ${run.requests} requisições · ${run.discovered} na lista · ` +
        `${run.created} novos · ${run.updated} atualizados · ${run.failed} falhas\n`,
    );
    for (const { url, error } of run.errors) process.stdout.write(`  falha: ${url} → ${error}\n`);
  }
  process.stdout.write(
    `Lotes ligados: ${summary.lotsUpdated} com lance novo · ${summary.resultsRecorded} resultados · ` +
      `${summary.alertsCreated} alertas\n`,
  );
  if (summary.status === "failed") process.exitCode = 1;
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readNumberFlag(name: string): number | undefined {
  const value = Number(readFlag(name));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  // O cliente do banco mantém conexões abertas; encerra quando a execução termina.
  .finally(() => setTimeout(() => process.exit(), 100).unref());
