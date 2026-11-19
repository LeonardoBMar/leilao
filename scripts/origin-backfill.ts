// Recalcula a origem do veículo gravada em todo o catálogo (D-73, docs/PLANO-MERCADO.md T0.4). Rode depois de mudar
// a regra (`inferOrigin`): a coleta só grava nos anúncios que visita. Idempotente.

import { runCli } from "./lib/cli";

async function main() {
  const { backfillOrigins } = await import("@/server/market/origins");

  const updated = await backfillOrigins();
  for (const [origin, count] of Object.entries(updated)) process.stdout.write(`${origin}: ${count} atualizados\n`);
}

runCli(main);
