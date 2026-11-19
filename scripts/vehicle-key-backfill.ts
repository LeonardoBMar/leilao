// Recalcula a chave do veículo gravada em todo o catálogo (D-77). Rode depois da migration que cria a coluna e depois
// de mudar a regra (`vehicleKey`, `BRAND_ALIASES`, `MODEL_RENAMES`): a coleta só grava nos anúncios que visita.
// Idempotente.

import { runCli } from "./lib/cli";

async function main() {
  const { backfillVehicleKeys } = await import("@/server/market/vehicle-keys");

  const { keys, updated } = await backfillVehicleKeys();
  process.stdout.write(`${keys} chaves, ${updated} anúncios atualizados\n`);
}

runCli(main);
