import { Eye } from "lucide-react";
import Link from "next/link";

import { Button, EmptyState, Money, Skeleton } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";

import { listLots } from "../queries";
import { LimitBadge } from "./limit-badge";

const SHOWN = 9;
const ALL_FOLLOWED_HREF = "/lotes?acompanhados=1&resultado=sem";

/**
 * "Lotes acompanhados" do dashboard (SPEC §5, DESIGN.md §15.1 e §19.5): ativos, marcados e ainda sem resultado,
 * com lance atual, limite fixado e a situação do lance.
 */
export async function FollowedLots() {
  const page = await listLots({
    search: undefined,
    followedOnly: true,
    analysis: undefined,
    result: "sem",
    archived: false,
    page: 1,
  });

  if (page.total === 0) {
    return (
      <EmptyState
        icon={Eye}
        title="Nenhum lote acompanhado"
        description="Marque um lote para acompanhar seu lance e limite no dashboard."
        action={
          <Button asChild variant="secondary">
            <Link href="/lotes">Ver lotes</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {page.items.slice(0, SHOWN).map((lot) => (
          <li key={lot.id} className="grid content-start gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="min-w-0">
              <Link href={`/lotes/${lot.id}`} className="font-semibold text-primary hover:underline">
                {lot.brand} {lot.model} {lot.modelYear}
              </Link>
              <p className="truncate text-caption text-muted">
                Lote {lot.lotNumber} · {lot.auction.name} · {formatDate(lot.auction.startsAt)}
              </p>
            </div>
            <dl className="grid gap-1 text-caption">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Lance atual</dt>
                <dd>
                  <Money value={lot.currentBid} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Meu limite</dt>
                <dd>
                  {lot.limit && !lot.limit.isViable ? (
                    <span className="text-muted">Sem lance viável</span>
                  ) : (
                    <Money value={lot.limit?.maxBid ?? null} />
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Lance atualizado</dt>
                <dd className="text-muted">
                  {lot.currentBidObservedAt ? formatDateTime(lot.currentBidObservedAt) : "—"}
                </dd>
              </div>
            </dl>
            <div>
              <LimitBadge limit={lot.limit} bid={lot.currentBid} />
            </div>
          </li>
        ))}
      </ul>
      {page.total > SHOWN ? (
        <Link href={ALL_FOLLOWED_HREF} className="w-fit text-body text-primary hover:underline">
          Ver todos os {page.total} lotes acompanhados
        </Link>
      ) : null}
    </div>
  );
}

export function FollowedLotsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      <Skeleton className="h-44" />
      <Skeleton className="h-44" />
      <Skeleton className="h-44" />
    </div>
  );
}
