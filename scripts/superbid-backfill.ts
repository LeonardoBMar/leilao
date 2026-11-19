// Carga avulsa dos lotes do Superbid encerrados nos últimos dias (D-60): a coleta agendada só descobre abertos, então
// sem isto o histórico de preços da fonte começaria vazio. Grava pelo mesmo caminho da coleta, com o desfecho e o preço
// final; anúncio já no catálogo é pulado. Rodar uma vez, de uma máquina com DATABASE_URL.
//
//   npm run db:superbid-backfill                     encerrados dos últimos 30 dias
//   npm run db:superbid-backfill -- --days 7         outra janela
//   npm run db:superbid-backfill -- --dry-run        só conta, sem visitar nem gravar

import { hasFlag, readNumberFlag, runCli } from "./lib/cli";

const DAY_MS = 86_400_000;

async function main() {
  const { backfillListings } = await import("@/server/collector/backfill");
  const { createPoliteFetcher } = await import("@/server/collector/http");
  const { discoverRecentlyClosed, superbidSource } = await import("@/sources/superbid");

  const days = readNumberFlag("--days") ?? 30;
  const since = new Date(Date.now() - days * DAY_MS);
  const fetcher = createPoliteFetcher();

  const closed = await discoverRecentlyClosed(fetcher, since);
  process.stdout.write(`Encerrados desde ${since.toISOString()}: ${closed.ids.length}\n`);
  if (closed.error) {
    process.stdout.write(`  lista incompleta: ${closed.error.url} → ${closed.error.error}\n`);
    process.exitCode = 1;
  }
  if (hasFlag("--dry-run")) return;

  const summary = await backfillListings({
    source: superbidSource,
    externalIds: closed.ids,
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
