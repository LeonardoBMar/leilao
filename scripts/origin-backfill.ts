// Recalcula a origem do veículo gravada em todo o catálogo (D-73, docs/PLANO-MERCADO.md T0.4). Rode depois de mudar
// a regra (`inferOrigin`): a coleta só grava nos anúncios que visita. Idempotente.

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { backfillOrigins } = await import("@/server/market/origins");

  const updated = await backfillOrigins();
  for (const [origin, count] of Object.entries(updated)) process.stdout.write(`${origin}: ${count} atualizados\n`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100).unref());
