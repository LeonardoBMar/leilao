// Preenche o catálogo de preços e as correlações da FIPE (D-49, docs/PLANO-FIPE-TABELAS.md §7) **sem pedir nada à
// FIPE**: tudo sai das respostas guardadas em `fipe_responses`. Idempotente; rode depois da migration
// `fipe_catalog_and_matches`.
//
// Uso: `npm run db:fipe-tables`. Lista os anúncios cujo valor recalculado difere do gravado (regra mudou desde o
// casamento) sem mexer neles; com --requeue-diffs, esses voltam à fila e são casados de novo na próxima coleta.

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { rebuildFipePrices } = await import("@/server/fipe/catalog");
  const { linkCheckedListings } = await import("@/server/fipe/link");
  const { formatBRL } = await import("@/lib/format");
  const { cents } = await import("@/domain/money");

  const prices = await rebuildFipePrices();
  process.stdout.write(
    `Catálogo: ${prices.read} valores guardados · ${prices.added} linhas novas · ${prices.skipped} fora do formato\n`,
  );

  const requeueDiffs = process.argv.includes("--requeue-diffs");
  const money = (value: number | null) => (value === null ? "sem valor" : formatBRL(cents(value)));
  const links = await linkCheckedListings({
    requeueDiffs,
    onDiff: ({ title, stored, computed }) =>
      process.stdout.write(
        `  diferente: ${title} → gravado ${money(stored.value)} (${stored.origin ?? "—"}), ` +
          `regra atual ${money(computed.value)} (${computed.origin ?? "—"})\n`,
      ),
  });
  process.stdout.write(
    `Correlações: ${links.read} anúncios · ${links.linked} ligados · ${links.diffs} diferentes` +
      `${requeueDiffs ? ` (${links.requeued} de volta à fila)` : ""} · ${links.notCached} sem resposta guardada\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100).unref());
