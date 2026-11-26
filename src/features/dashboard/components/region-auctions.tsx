import { ChevronRight, CircleCheck, Clock } from "lucide-react";
import Link from "next/link";

import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { getRegionOverview } from "@/features/listings/queries";
import type { RegionAuction } from "@/features/listings/types";
import { getUserPreferences } from "@/features/preferences/queries";
import { CATALOG_AUCTIONS_PATH, catalogAuctionPath } from "@/lib/catalog-search";
import { formatDayParts, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ptBrPlural = new Intl.PluralRules("pt-BR");
const plural = (count: number, one: string, many: string) =>
  `${count} ${ptBrPlural.select(count) === "one" ? one : many}`;

/**
 * "Próximos leilões na região" (D-44, DESIGN.md §15.1): leilões do catálogo nos próximos 7 dias com lotes no filtro
 * padrão ou nos monitores, agrupados por dia, com quantos lotes estão no filtro e quantos cabem no limite.
 */
export async function RegionAuctions() {
  const [{ auctions }, { region }] = await Promise.all([getRegionOverview(), getUserPreferences()]);

  if (auctions.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhum leilão na região nos próximos 7 dias"
        description={
          <>
            Leilões dos sites com lotes nos próximos 7 dias na{" "}
            <Link
              href="/sistema/preferencias"
              className="rounded-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent"
            >
              sua região-base
            </Link>{" "}
            (até {region.radiusKm} km de {region.label}) ou nos{" "}
            <Link
              href="/monitores"
              className="rounded-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent"
            >
              seus monitores
            </Link>{" "}
            aparecem aqui, por data.
          </>
        }
        action={
          <ButtonLink href={CATALOG_AUCTIONS_PATH} variant="secondary" size="sm">
            Ver catálogo de leilões
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="@container grid gap-3">
      <ol role="list" className="grid">
        {groupByDay(auctions).map(({ key, parts, items }) => (
          <li
            key={key}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 border-t border-border pt-4 pb-2 @lg:grid-cols-[6rem_minmax(0,1fr)] @lg:gap-x-6"
          >
            {key === "sem-data" ? (
              <p className="grid content-start">
                <span className="text-heading-1 tabular-nums">{parts.day}</span>
                <span className="text-caption text-muted">Sem data</span>
              </p>
            ) : (
              <time dateTime={key} className="grid content-start">
                <span className="text-heading-1 tabular-nums">{parts.day}</span>
                <span className="text-label text-foreground-secondary">{parts.month}</span>
                <span className="text-caption text-muted">{parts.weekday}</span>
              </time>
            )}
            <ul role="list" className="grid content-start border-l border-border">
              {items.map((auction) => (
                <li
                  key={`${auction.sourceId}/${auction.externalId}`}
                  className="relative flex min-h-11 flex-col gap-1 rounded-r-md border-border py-2.5 pr-2 pl-5 transition-colors duration-150 ease-[var(--ease-out)] not-first:border-t hover:bg-background motion-reduce:transition-none @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-4"
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
                        <time dateTime={auction.date.toISOString()}>{formatTime(auction.date)}</time>
                      </span>
                    ) : null}
                    <Link
                      href={catalogAuctionPath(auction)}
                      className="group inline-flex max-w-full items-center gap-1 rounded-sm font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-r-md hover:underline focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-inset"
                    >
                      <span title={auction.name ?? "Leilão sem nome"} className="line-clamp-2">
                        {auction.name ?? "Leilão sem nome"}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
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
                          {plural(auction.fitting, "cabe no limite", "cabem no limite")}
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
        Ver todos<span className="sr-only"> os leilões</span>
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
