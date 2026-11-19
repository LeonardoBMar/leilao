// Backtest do preço provável (docs/PLANO-MERCADO.md, T0.1 e T0.6): estima cada venda do catálogo só com as vendas que
// encerraram antes do dia dela e mede quantas caíram dentro da faixa P25–P75 e o erro da mediana, para cada variante
// do motor de comparáveis (D-72). Só leitura.
//
// Opções:
//   --from <aaaa-mm-dd>  primeira data dos alvos (padrão: 2026-09-15, quando a base passou de mil vendas)
//   --variant <nome>     só uma variante (v1, v2, v2-origem); sem ela, todas
//   --write              grava o resumo do motor das telas (v1) em src/features/research/engine-quality.json, que a
//                        aba Calibração mostra (D-76); o arquivo vai no commit

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { hasFlag, readFlag, runCli } from "./lib/cli";

async function main() {
  const { loadSoldSales } = await import("@/server/market/sold-sales");
  const { runBacktest, summarizeBacktest, summarizeBacktestBy } = await import("@/domain/listings/backtest");
  const { buildEstimateIndex, COMPARABLE_LEVELS, estimatePrice, SALES_WINDOW_MS } =
    await import("@/domain/listings/estimates");

  const variants = {
    v1: { levels: ["model"], preferOrigin: false },
    v2: { levels: COMPARABLE_LEVELS, preferOrigin: false },
    "v2-origem": { levels: COMPARABLE_LEVELS, preferOrigin: true },
  } as const;
  const only = readFlag("--variant");
  const write = hasFlag("--write");
  const from = new Date(`${readFlag("--from") ?? "2026-09-15"}T00:00:00-03:00`);
  const sales = await loadSoldSales();

  type Summary = ReturnType<typeof summarizeBacktest>;
  const pct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);
  const line = (label: string, summary: Summary) =>
    `${label.padEnd(30)} ${String(summary.total).padStart(6)} ${String(summary.estimated).padStart(6)} ` +
    `${pct(summary.estimated / Math.max(1, summary.total)).padStart(7)} ${pct(summary.hitRate).padStart(7)} ` +
    `${pct(summary.medianAbsError).padStart(7)}\n`;
  const header =
    `${"grupo".padEnd(30)} ${"vendas".padStart(6)} ${"estim.".padStart(6)} ${"cobre".padStart(7)} ` +
    `${"faixa".padStart(7)} ${"erro".padStart(7)}\n`;

  process.stdout.write(`${sales.length} vendas; alvos desde ${from.toISOString().slice(0, 10)}\n`);
  for (const [name, options] of Object.entries(variants)) {
    if (only !== undefined && only !== name) continue;
    const outcomes = runBacktest(
      sales,
      (prior) => {
        const index = buildEstimateIndex(prior);
        return (target) => estimatePrice(target, index, options);
      },
      { from, windowMs: SALES_WINDOW_MS },
    );
    if (write && name === "v1") {
      const byConfidence = summarizeBacktestBy(outcomes, ({ estimate }) =>
        estimate.kind === "insufficient" ? "none" : estimate.confidence,
      );
      const quality = {
        version: 1,
        computedAt: new Date().toISOString(),
        from: from.toISOString(),
        total: summarizeBacktest(outcomes),
        byConfidence: Object.fromEntries(
          (["high", "medium", "low"] as const).flatMap((level) => {
            const summary = byConfidence.get(level);
            return summary === undefined ? [] : [[level, summary]];
          }),
        ),
      };
      const path = join(process.cwd(), "src/features/research/engine-quality.json");
      writeFileSync(path, `${JSON.stringify(quality, null, 2)}\n`);
      process.stdout.write(`resumo gravado em ${path}\n`);
    }
    process.stdout.write(`\n== ${name}\n${header}`);
    process.stdout.write(line("total", summarizeBacktest(outcomes)));
    const groups = [
      ({ estimate }: (typeof outcomes)[number]) =>
        estimate.kind === "comparables" ? `nível: ${estimate.level}` : `nível: ${estimate.kind}`,
      ({ estimate }: (typeof outcomes)[number]) =>
        estimate.kind === "insufficient" ? "confiança: —" : `confiança: ${estimate.confidence}`,
      ({ estimate }: (typeof outcomes)[number]) =>
        estimate.kind === "comparables" ? `mesma origem: ${estimate.sameOrigin ? "sim" : "não"}` : "mesma origem: —",
      ({ sale }: (typeof outcomes)[number]) => `categoria: ${sale.category ?? "?"}`,
    ];
    for (const groupOf of groups) {
      for (const [key, summary] of [...summarizeBacktestBy(outcomes, groupOf)].sort(([a], [b]) => a.localeCompare(b))) {
        process.stdout.write(line(key, summary));
      }
    }
  }
}

runCli(main);
