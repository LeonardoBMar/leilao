// Casa na tabela FIPE oficial o valor de mercado dos anúncios sem valor da fonte (D-47, docs/PLANO-VALOR-MERCADO.md).
// Uso: `npm run db:market-values` depois da migration `market_value_origin`; retoma de onde parou (cada anúncio é
// tentado uma vez e as respostas da FIPE ficam guardadas). A coleta faz o mesmo com os anúncios novos.
//
// Opções: --limit <n> para depois de n anúncios; --source <id> só os anúncios de uma fonte; --dry-run calcula e lista
// sem gravar (conferência manual).

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { createPoliteFetcher } = await import("@/server/collector/http");
  const { createFipeClient } = await import("@/server/fipe/client");
  const { enrichMarketValues } = await import("@/server/fipe/enrich");
  const { formatBRL } = await import("@/lib/format");

  const dryRun = process.argv.includes("--dry-run");
  const limit = readNumberFlag("--limit");
  const sourceId = readFlag("--source");
  const fetcher = createPoliteFetcher();
  const reasons = new Map<string, number>();

  const summary = await enrichMarketValues({
    client: createFipeClient(fetcher.post),
    now: () => new Date(),
    deadline: Number.POSITIVE_INFINITY,
    ...(limit === undefined ? {} : { limit }),
    ...(sourceId === undefined ? {} : { sourceId }),
    dryRun,
    onSample: (sample) => {
      reasons.set(sample.reason, (reasons.get(sample.reason) ?? 0) + 1);
      if (!dryRun && (reasons.get(sample.reason) ?? 0) % 100 !== 1) return;
      const value = sample.match
        ? `${formatBRL(sample.match.value)} (${sample.match.origin === "fipe_version" ? "versão" : "família"})`
        : sample.reason;
      process.stdout.write(
        `${sample.title} → ${value}${sample.labels.length ? ` · ${sample.labels.join(" | ")}` : ""}\n`,
      );
    },
  });

  process.stdout.write(
    `\n${summary.checked} anúncios · ${summary.matched.version} por versão · ${summary.matched.family} por família · ` +
      `${fetcher.requests} pedidos à FIPE${dryRun ? " · nada gravado" : ""}\n`,
  );
  for (const [reason, count] of reasons) process.stdout.write(`  ${reason}: ${count}\n`);
  if (summary.stoppedBy) process.stdout.write(`Parou antes do fim: ${summary.stoppedBy}\n`);
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
  .finally(() => setTimeout(() => process.exit(), 100).unref());
