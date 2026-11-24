// Coletor de anúncios (docs/PLANO-COLETA.md, D-26, D-37). Uso: `npm run collect` (local) ou o workflow agendado
// `.github/workflows/collect.yml`. Precisa só de DATABASE_URL. Roda sem usuário: grava o catálogo global de todas as
// fontes de src/sources/index.ts, o lance e o resultado dos lotes ligados a anúncios (D-34, D-35) e os alertas (D-32).
//
// Opções: --max-visits <n> (padrão 400) limita os anúncios lidos por fonte nesta execução;
// --source <id> coleta só uma fonte (ex.: para testar um adaptador novo).

import { appendFile } from "node:fs/promises";

import type { CollectionSummary } from "@/server/collector/run";

import { readFlag, readNumberFlag, runCli } from "./lib/cli";

const SOURCE_STATUS_LABELS = {
  succeeded: "ok",
  failed: "falha",
  skipped: "pausada",
} as const;

function formatStepSummary(summary: CollectionSummary): string {
  const lines: string[] = [
    `## Coleta do catálogo (${summary.status === "succeeded" ? "ok" : "com falhas"})`,
    "",
    "| Fonte | Status | Requisições | Na lista | Novos | Atualizados | Falhas |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...summary.sources.map(
      (run) =>
        `| \`${run.sourceId}\` | ${SOURCE_STATUS_LABELS[run.status]} | ${run.requests} | ${run.discovered} | ${run.created} | ${run.updated} | ${run.failed} |`,
    ),
    "",
    `- **Lotes ligados:** ${summary.lotsUpdated} com lance novo · ${summary.resultsRecorded} resultados`,
    `- **Alertas criados:** ${summary.alertsCreated} · **FIPE casados:** ${summary.marketValuesMatched}`,
  ];
  if (summary.maintenance.rawPruned > 0 || summary.maintenance.runsDeleted > 0) {
    lines.push(
      `- **Manutenção:** ${summary.maintenance.rawPruned} payloads \`raw\` compactados · ${summary.maintenance.runsDeleted} execuções removidas`,
    );
  }
  if (summary.engineQuality?.status === "saved") {
    lines.push(
      `- **Backtest do motor:** snapshot gravado (${summary.engineQuality.estimated} de ${summary.engineQuality.total} vendas estimadas)`,
    );
  }
  if (summary.warnings.length > 0) {
    lines.push("", "### Avisos", ...summary.warnings.map((warning) => `- ${warning}`));
  }
  const sourceErrors = summary.sources.flatMap((run) =>
    run.errors.map((item) => `- \`${run.sourceId}\` ${item.url}: ${item.error}`),
  );
  if (sourceErrors.length > 0 || summary.errors.length > 0) {
    lines.push(
      "",
      "### Falhas (amostra)",
      ...summary.errors.map((item) => `- ${item.url}: ${item.error}`),
      ...sourceErrors.slice(0, 20),
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
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
      `${summary.alertsCreated} alertas · ${summary.marketValuesMatched} valores de mercado da FIPE\n`,
  );
  for (const item of summary.fipeImports) {
    if (item.kind === "imported") {
      process.stdout.write(
        `Tabela FIPE ${item.month}: ${item.prices} preços importados · ${item.requeued} anúncios de volta à fila\n`,
      );
    } else if (item.kind === "unpublished") {
      process.stdout.write(`Tabela FIPE ${item.month}: ainda não publicada no dataset\n`);
    }
  }
  if (summary.maintenance.rawPruned > 0 || summary.maintenance.runsDeleted > 0) {
    process.stdout.write(
      `Manutenção: ${summary.maintenance.rawPruned} payloads raw compactados · ` +
        `${summary.maintenance.runsDeleted} execuções antigas removidas\n`,
    );
  }
  if (summary.engineQuality?.status === "saved") {
    process.stdout.write(
      `Backtest do motor: snapshot gravado (${summary.engineQuality.estimated} de ${summary.engineQuality.total} vendas estimadas)\n`,
    );
  }
  for (const warning of summary.warnings) process.stdout.write(`  aviso: ${warning}\n`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await appendFile(summaryPath, formatStepSummary(summary), "utf8");
  }
  if (summary.status === "failed") process.exitCode = 1;
}

runCli(main);
