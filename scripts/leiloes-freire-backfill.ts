// Carga avulsa dos leilões encerrados da Leilões Freire (D-68): a coleta agendada só descobre os leilões abertos (4 em
// 11/10/2026), então sem isto Sergipe e boa parte de Alagoas começariam sem histórico. Os leilões têm id sequencial;
// a carga lê cada um da faixa, fica com os lotes de veículo e grava pelo mesmo caminho da coleta, com o desfecho e o
// preço final. Anúncio já no catálogo é pulado. Rodar uma vez, de uma máquina com DATABASE_URL.
//
//   npm run db:freire-backfill                          os 50 leilões antes do mais novo aberto
//   npm run db:freire-backfill -- --from 1140 --to 1182 outra faixa
//   npm run db:freire-backfill -- --dry-run             só conta, sem gravar

import { hasFlag, readNumberFlag, runCli } from "./lib/cli";

async function main() {
  const { backfillListings } = await import("@/server/collector/backfill");
  const { createPoliteFetcher } = await import("@/server/collector/http");
  const { leiloesFreireSource, lotsOfAuction } = await import("@/sources/leiloes-freire");
  const { isFreireVehicle, LEILOES_FREIRE_AUCTIONS_URL, parseLeiloesFreireAuctions } =
    await import("@/sources/leiloes-freire/parse");

  const fetcher = createPoliteFetcher();
  let to = readNumberFlag("--to");
  if (to === undefined) {
    const list = await fetcher.get(LEILOES_FREIRE_AUCTIONS_URL);
    const open = list.ok ? parseLeiloesFreireAuctions(list.text) : null;
    if (!open || open.length === 0) throw new Error("lista de leilões abertos indisponível; passe --to");
    to = Math.max(...open.map(Number));
  }
  const from = readNumberFlag("--from") ?? to - 50;

  const ids: string[] = [];
  for (let auction = from; auction <= to; auction++) {
    const lots = await lotsOfAuction(fetcher, String(auction));
    if (!lots.ok) {
      process.stdout.write(`  leilão ${auction}: ${lots.error}\n`);
      continue;
    }
    const vehicles = lots.value.filter((lot) => isFreireVehicle(lot.description));
    ids.push(...vehicles.map((lot) => lot.lotId));
    if (vehicles.length > 0) process.stdout.write(`  leilão ${auction}: ${vehicles.length} veículos\n`);
  }
  process.stdout.write(`Leilões ${from} a ${to}: ${ids.length} lotes de veículo\n`);
  if (hasFlag("--dry-run")) return;

  // Mesmo `fetcher` da varredura: os lotes já lidos saem do cache da fonte, sem nova requisição.
  const summary = await backfillListings({
    source: leiloesFreireSource,
    externalIds: ids,
    fetcher,
    onProgress: (done, total) => {
      if (done % 100 === 0 || done === total) process.stdout.write(`  ${done}/${total}\n`);
    },
  });
  process.stdout.write(
    `Carga: ${summary.created} novos · ${summary.updated} atualizados · ${summary.skipped} já no catálogo · ` +
      `${summary.failed} falhas · ${fetcher.requests} requisições\n`,
  );
  for (const { url, error } of summary.errors) process.stdout.write(`  falha: ${url} → ${error}\n`);
  if (summary.stopped) process.exitCode = 1;
}

runCli(main);
