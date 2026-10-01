import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { Badge, ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import { ORIGIN_LABELS, STATUS_BADGE_VARIANTS, STATUS_LABELS } from "../labels";
import { listUpcomingAuctions } from "../queries";

/** Seção "Próximos leilões" do dashboard (SPEC §5, DESIGN.md §15.1). */
export async function UpcomingAuctions() {
  const auctions = await listUpcomingAuctions();

  if (auctions.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
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
    <ul className="grid gap-3">
      {auctions.map((auction) => (
        <li
          key={auction.id}
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <Link href={`/leiloes/${auction.id}`} className="font-semibold text-accent hover:underline">
              {auction.name}
            </Link>
            <p className="text-caption text-muted">
              {formatDateTime(auction.startsAt)} · {auction.auctioneer} · {ORIGIN_LABELS[auction.origin]}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-caption text-muted tabular-nums">
              {auction.lotCount} {auction.lotCount === 1 ? "lote" : "lotes"}
            </span>
            <Badge variant={STATUS_BADGE_VARIANTS[auction.status]}>{STATUS_LABELS[auction.status]}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function UpcomingAuctionsSkeleton() {
  return <Skeleton className="h-48" aria-hidden="true" />;
}
