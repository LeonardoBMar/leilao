// Backtest do preço provável (docs/PLANO-MERCADO.md, T0.1 e T0.6): estima cada venda do catálogo só com as vendas que
// encerraram antes do dia dela e mede quantas caíram dentro da faixa P25–P75 e o erro da mediana, para cada variante
// do motor de comparáveis (D-72). Só leitura.
//
// Opções:
//   --from <aaaa-mm-dd>  primeira data dos alvos (padrão: 2026-09-15, quando a base passou de mil vendas)
//   --variant <nome>     só uma variante (v1, v2, v2-origem); sem ela, todas

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
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

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100).unref());
