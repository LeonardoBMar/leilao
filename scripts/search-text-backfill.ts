// Recalcula o texto normalizado de busca (`listings.search_text`, D-91) em todo o catálogo.
// Rode depois da migration que cria a coluna e depois de mudar `listingSearchText`: a coleta só grava nos anúncios
// que visita. Idempotente.

import { runCli } from "./lib/cli";

async function main() {
  const { backfillSearchText } = await import("@/server/market/search-text");

  const { scanned, updated } = await backfillSearchText();
  process.stdout.write(`${scanned} anúncios lidos, ${updated} atualizados\n`);
}

runCli(main);
