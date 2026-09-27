// Preenche descrição e condição (dano, marcações, laudo) dos anúncios já coletados, relendo `listings.raw`.
// Uso: `npm run db:backfill-condition`, depois de aplicar a migration. Idempotente. A gravação fica em src/server.

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { backfillListingDetails } = await import("@/server/collector/backfill");
  const { leiloSource } = await import("@/sources/leilo");

  const { scanned, updated, skipped } = await backfillListingDetails(leiloSource);
  process.stdout.write(
    `${leiloSource.id}: ${scanned} lidos · ${updated} atualizados · ${skipped} sem dado bruto reconhecível\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100).unref());
