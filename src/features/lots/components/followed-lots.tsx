import { ChevronRight, CircleAlert, CircleCheck, Clock, type LucideIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Badge, ButtonLink, EmptyState, Money, Skeleton } from "@/components/ui";
import type { LimitFit } from "@/domain/listings/estimates";
import { formatClosingCountdown, formatCompactDateTime, formatDate } from "@/lib/format";
import { LIMIT_FIT_LABELS, LIMIT_FIT_VARIANTS, priceEvidenceLabel } from "@/lib/listing-labels";
import { cn } from "@/lib/utils";

import { getFollowedLotsOverview } from "../queries";
import type { FollowedLotItem } from "../types";
import { LimitProgress } from "./limit-progress";

const SHOWN = 5;
const ALL_FOLLOWED_HREF = "/minhas-analises?acompanhados=1&resultado=sem";

const LIMIT_FIT_ICONS = {
  comfortable: CircleCheck,
  tight: TriangleAlert,
  above: CircleAlert,
} as const satisfies Record<LimitFit, LucideIcon>;

/**
 * "Lotes acompanhados" do dashboard (SPEC §5, DESIGN.md §15.1 e §19.5, D-44): ativos, marcados e ainda sem
 * resultado, do que encerra primeiro, em linhas com lance atual, limite fixado, a distância até o limite e o provável
 * lance final frente ao limite.
 */
export async function FollowedLots() {
  const { items, now } = await getFollowedLotsOverview();

  if (items.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhum lote acompanhado"
        description="Adicione um lote de Leilões à análise (ele já entra acompanhado) para ver lance e limite aqui."
        action={
          <ButtonLink href="/leiloes/veiculos" variant="secondary" size="sm">
            Explorar veículos
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="@container grid gap-3">
      <ul role="list" className="border-b border-border">
        {items.slice(0, SHOWN).map((lot) => {
          const lotTitle = `${lot.brand} ${lot.model} ${lot.modelYear}`;
          const closing = lot.endsAt ? formatClosingCountdown(lot.endsAt, now) : null;
          return (
            <li
              key={lot.id}
              className="relative -mx-2 grid grid-cols-1 items-center gap-x-5 gap-y-3 rounded-md border-t border-border px-2 py-4 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-background @2xl:grid-cols-[3.5rem_minmax(0,1fr)_9.5rem_12rem]"
            >
              <span className="hidden font-mono text-label font-normal text-foreground-secondary @2xl:inline">
                {lot.lotNumber}
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 font-mono text-caption font-normal text-muted @2xl:hidden">
                    #{lot.lotNumber}
                  </span>
                  <Link
                    href={`/lotes/${lot.id}`}
                    className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-semibold text-foreground outline-none after:absolute after:inset-0 after:rounded-md hover:underline focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-inset"
                  >
                    <span title={lotTitle} className="line-clamp-2">
                      {lotTitle}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-foreground"
                    />
                  </Link>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted">
                  <span title={lot.auction.name} className="line-clamp-1 min-w-0">
                    {lot.auction.name}
                  </span>
                  <span aria-hidden="true" className="text-border-strong">
                    ·
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 tabular-nums",
                      closing?.isUrgent ? "font-medium text-warning" : "text-muted",
                    )}
                  >
                    <Clock
                      aria-hidden="true"
                      className={cn("size-3 shrink-0", closing?.isUrgent ? "text-warning" : "text-muted-subtle")}
                    />
                    {lot.endsAt && closing ? (
                      <time dateTime={lot.endsAt.toISOString()}>{closing.label}</time>
                    ) : (
                      <time dateTime={lot.auction.startsAt.toISOString()}>{formatDate(lot.auction.startsAt)}</time>
                    )}
                  </span>
                  {lot.currentBid !== null && lot.currentBidObservedAt !== null ? (
                    <>
                      <span aria-hidden="true" className="text-border-strong">
                        ·
                      </span>
                      <span className="shrink-0 tabular-nums">
                        visto{" "}
                        <time dateTime={lot.currentBidObservedAt.toISOString()}>
                          {formatCompactDateTime(lot.currentBidObservedAt)}
                        </time>
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="grid gap-0.5 @2xl:text-end">
                <p className="text-caption text-muted">Lance</p>
                <p className="text-body-lg font-semibold text-foreground tabular-nums">
                  <Money value={lot.currentBid} />
                </p>
                <p className="text-caption text-muted tabular-nums">
                  {lot.limit?.isViable && lot.limit.maxBid !== null ? (
                    <>
                      Limite <Money value={lot.limit.maxBid} className="font-medium text-foreground-secondary" />
                    </>
                  ) : (
                    "Sem limite fixado"
                  )}
                </p>
              </div>
              <div className="grid gap-1.5">
                <LimitProgress limit={lot.limit} bid={lot.currentBid} />
                <ProbableLine lot={lot} />
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > SHOWN ? (
        <ButtonLink href={ALL_FOLLOWED_HREF} variant="secondary" size="sm" className="w-fit">
          Ver todos<span className="sr-only"> os lotes acompanhados</span>
          <ChevronRight aria-hidden="true" />
        </ButtonLink>
      ) : null}
    </div>
  );
}

/** Provável lance final do anúncio ligado frente ao limite fixado; sem anúncio aberto, nada (D-44). */
function ProbableLine({ lot }: { lot: FollowedLotItem }) {
  const { price, fit } = lot;
  if (price === null) return null;
  if (price.kind === "insufficient") {
    return (
      <p className="text-caption text-muted">
        Provável: sem base ({price.comparables} de {price.needed})
      </p>
    );
  }
  const FitIcon = fit ? LIMIT_FIT_ICONS[fit] : null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
      <span>
        Provável <Money value={price.median} className="font-medium text-foreground-secondary" /> (
        {priceEvidenceLabel(price)})
      </span>
      {fit !== null && FitIcon ? (
        <Badge variant={LIMIT_FIT_VARIANTS[fit]}>
          <FitIcon aria-hidden="true" className="size-3 shrink-0" />
          {LIMIT_FIT_LABELS[fit]}
        </Badge>
      ) : null}
    </p>
  );
}

export function FollowedLotsSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );
}
