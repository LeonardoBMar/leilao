// Rederiva do dado bruto (`listings.raw`) descrição, condição e situação dos anúncios já coletados, sem baixar
// páginas. Uso: `npm run db:reparse`, depois de mudar a extração de um adaptador. Idempotente. A gravação fica em
// src/server.

import { loadEnvConfig } from "@next/env";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const { reparseListings } = await import("@/server/collector/reparse");
  const { SOURCES } = await import("@/sources");

  for (const source of SOURCES) {
    const { scanned, updated, statusChanged, skipped } = await reparseListings(source, new Date());
    process.stdout.write(
      `${source.id}: ${scanned} lidos · ${updated} atualizados · ${statusChanged} com situação nova · ` +
        `${skipped} sem dado bruto reconhecível\n`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100).unref());
