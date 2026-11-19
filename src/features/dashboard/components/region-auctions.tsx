import { ChevronRight, CircleCheck, Clock } from "lucide-react";
import Link from "next/link";

import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { getRegionOverview } from "@/features/listings/queries";
import { CATALOG_AUCTIONS_PATH, catalogAuctionPath } from "@/features/listings/search";
import type { RegionAuction } from "@/features/listings/types";
import { formatDayParts, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "Próximos leilões na região" (D-44, DESIGN.md §15.1): leilões do catálogo nos próximos 7 dias com lotes no filtro
 * padrão ou nos monitores, agrupados por dia, com quantos lotes estão no filtro e quantos cabem no limite.
 */
export async function RegionAuctions() {
  const { auctions } = await getRegionOverview();

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
            <ul className="grid content-start border-l border-border">
              {items.map((auction) => (
                <li
                  key={`${auction.sourceId}/${auction.externalId}`}
                  className="relative flex flex-col gap-1 border-border py-2.5 pl-5 not-first:border-t sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-4 left-0 size-2 -translate-x-1/2 rounded-full ring-2 ring-surface",
                      auction.fitting > 0 ? "bg-foreground" : "border border-border-strong bg-surface",
                    )}
                  />
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    {auction.date ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-label font-normal text-muted tabular-nums">
                        <Clock aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                        {formatTime(auction.date)}
                      </span>
                    ) : null}
                    <Link
                      href={catalogAuctionPath(auction)}
                      className="group inline-flex max-w-full items-center gap-1 font-medium text-foreground hover:underline"
                    >
                      <span className="truncate">{auction.name ?? "Leilão sem nome"}</span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted-subtle transition-transform duration-120 group-hover:translate-x-0.5 group-hover:text-foreground"
                      />
                    </Link>
                    <span className="text-caption text-muted">· {auction.sourceName}</span>
                  </p>
                  <span className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted tabular-nums">
                    <span>{auction.matching} no filtro</span>
                    {auction.fitting > 0 ? (
                      <>
                        <span aria-hidden="true" className="text-border-strong">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-success">
                          <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />
                          {auction.fitting} cabem no limite
                        </span>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <ButtonLink href={CATALOG_AUCTIONS_PATH} variant="secondary" size="sm" className="w-fit">
        Ver todos
        <ChevronRight aria-hidden="true" />
      </ButtonLink>
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
