import Link from "next/link";

import { EmptyState, Skeleton } from "@/components/ui";
import { getRegionOverview } from "@/features/listings/queries";
import { CATALOG_AUCTIONS_PATH, catalogAuctionPath } from "@/features/listings/search";
import type { RegionAuction } from "@/features/listings/types";
import { formatDayParts, formatTime } from "@/lib/format";

/**
 * "Próximos leilões na região" (D-44, DESIGN.md §15.1): leilões do catálogo nos próximos 7 dias com lotes no filtro
 * padrão ou nos monitores, agrupados por dia, com quantos lotes estão no filtro e quantos cabem no limite.
 */
export async function RegionAuctions() {
  const { auctions, auctionsTotal } = await getRegionOverview();

  if (auctions.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhum leilão na região nos próximos 7 dias"
        description="Leilões dos sites com lotes no filtro padrão ou nos seus monitores aparecem aqui, por data."
      />
    );
  }

  return (
    <div className="grid gap-3">
      <ol className="grid">
        {groupByDay(auctions).map(({ key, parts, items }) => (
          <li
            key={key}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 border-t border-border pt-4 pb-2 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-6"
          >
            <p className="grid content-start">
              <span className="text-heading-1 tabular-nums">{parts.day}</span>
              <span className="text-label text-foreground-secondary">{parts.month}</span>
              <span className="text-caption text-muted">{parts.weekday}</span>
            </p>
            <ul className="grid content-start">
              {items.map((auction) => (
                <li
                  key={`${auction.sourceId}/${auction.externalId}`}
                  className="flex flex-col gap-1 border-border py-2.5 not-first:border-t sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <p className="min-w-0">
                    {auction.date ? (
                      <span className="mr-3 text-label font-normal text-muted tabular-nums">
                        {formatTime(auction.date)}
                      </span>
                    ) : null}
                    <Link href={catalogAuctionPath(auction)} className="font-medium text-foreground hover:underline">
                      {auction.name ?? "Leilão sem nome"}
                    </Link>
                    <span className="text-caption text-muted"> · {auction.sourceName}</span>
                  </p>
                  <span className="shrink-0 text-caption text-muted tabular-nums">
                    {auction.matching} no filtro
                    {auction.fitting > 0 ? (
                      <span className="font-semibold text-foreground"> · {auction.fitting} cabem no limite</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {auctionsTotal > auctions.length ? (
        <Link href={CATALOG_AUCTIONS_PATH} className="w-fit text-label text-accent hover:underline">
          Ver os {auctionsTotal} leilões no catálogo
        </Link>
      ) : null}
    </div>
  );
}

/** Leilões sem data ficam num grupo próprio, no fim (a ordem já vem por data). */
function groupByDay(auctions: RegionAuction[]) {
  const groups: { key: string; parts: ReturnType<typeof formatDayParts>; items: RegionAuction[] }[] = [];
  for (const auction of auctions) {
    const parts = auction.date ? formatDayParts(auction.date) : { key: "sem-data", day: "—", month: "", weekday: "" };
    const last = groups.at(-1);
    if (last?.key === parts.key) last.items.push(auction);
    else groups.push({ key: parts.key, parts, items: [auction] });
  }
  return groups;
}

export function RegionAuctionsSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}
