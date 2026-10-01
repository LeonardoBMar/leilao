import Link from "next/link";

import { Badge, ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { formatDayParts, formatTime } from "@/lib/format";

import { ORIGIN_LABELS, STATUS_BADGE_VARIANTS, STATUS_LABELS } from "../labels";
import { listUpcomingAuctions } from "../queries";
import type { AuctionListItem } from "../types";

/** Seção "Próximos leilões" do dashboard (SPEC §5, DESIGN.md §15.1): agenda agrupada por dia. */
export async function UpcomingAuctions() {
  const auctions = await listUpcomingAuctions();

  if (auctions.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhum leilão próximo"
        description="Leilões agendados ou em andamento aparecem aqui, por data."
        action={
          <ButtonLink href="/leiloes/novo" variant="secondary">
            Cadastrar leilão
          </ButtonLink>
        }
      />
    );
  }

  return (
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
                key={auction.id}
                className="flex flex-col gap-1 border-border py-2.5 not-first:border-t sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <p className="min-w-0">
                  <span className="mr-3 text-label font-normal text-muted tabular-nums">
                    {formatTime(auction.startsAt)}
                  </span>
                  <Link href={`/leiloes/${auction.id}`} className="font-medium text-foreground hover:underline">
                    {auction.name}
                  </Link>
                  <span className="text-caption text-muted">
                    {" "}
                    · {auction.auctioneer} · {ORIGIN_LABELS[auction.origin]}
                  </span>
                </p>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-caption text-muted tabular-nums">
                    {auction.lotCount} {auction.lotCount === 1 ? "lote" : "lotes"}
                  </span>
                  {auction.status === "scheduled" ? null : (
                    <Badge variant={STATUS_BADGE_VARIANTS[auction.status]}>{STATUS_LABELS[auction.status]}</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function groupByDay(auctions: AuctionListItem[]) {
  const groups: { key: string; parts: ReturnType<typeof formatDayParts>; items: AuctionListItem[] }[] = [];
  for (const auction of auctions) {
    const parts = formatDayParts(auction.startsAt);
    const last = groups.at(-1);
    if (last?.key === parts.key) last.items.push(auction);
    else groups.push({ key: parts.key, parts, items: [auction] });
  }
  return groups;
}

export function UpcomingAuctionsSkeleton() {
  return <Skeleton className="h-48" aria-hidden="true" />;
}
