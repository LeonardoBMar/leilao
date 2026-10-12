// Recalcula a chave do veículo gravada em todo o catálogo (D-77). Rode depois da migration que cria a coluna e depois
// de mudar a regra (`vehicleKey`, `BRAND_ALIASES`, `MODEL_RENAMES`): a coleta só grava nos anúncios que visita.
// Idempotente.

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { backfillVehicleKeys } = await import("@/server/market/vehicle-keys");

  const { keys, updated } = await backfillVehicleKeys();
  process.stdout.write(`${keys} chaves, ${updated} anúncios atualizados\n`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100).unref());
