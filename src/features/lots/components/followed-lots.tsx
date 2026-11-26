import { ChevronRight, CircleAlert, CircleCheck, Clock, type LucideIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Badge, ButtonLink, EmptyState, Money, Skeleton } from "@/components/ui";
import type { LimitFit } from "@/domain/listings/estimates";
import { formatClosingCountdown, formatCompactDateTime, formatDate } from "@/lib/format";
import { LIMIT_FIT_VARIANTS, priceEvidenceLabel } from "@/lib/listing-labels";
import { cn } from "@/lib/utils";

import { getFollowedLotsOverview } from "../queries";
import type { FollowedLotItem } from "../types";
import { LimitProgress } from "./limit-progress";

const SHOWN = 5;
const ALL_FOLLOWED_HREF = "/minhas-analises?acompanhados=1&resultado=sem";

const PROBABLE_FIT_LABELS = {
  comfortable: "Provável abaixo",
  tight: "Provável no limite",
  above: "Provável acima",
} as const satisfies Record<LimitFit, string>;

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
      <ul role="list" className="-mx-2 border-b border-border">
        {items.slice(0, SHOWN).map((lot) => {
          const lotTitle = `${lot.brand} ${lot.model} ${lot.modelYear}`;
          const closing = lot.endsAt ? formatClosingCountdown(lot.endsAt, now) : null;
          return (
            <li
              key={lot.id}
              className="relative grid grid-cols-1 items-center gap-x-5 gap-y-3 rounded-md border-t border-border px-2 py-4 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-background motion-reduce:transition-none @xl:grid-cols-[3.5rem_minmax(0,1fr)_minmax(10rem,auto)_13rem]"
            >
              <span
                title={lot.lotNumber}
                className="hidden truncate font-mono text-label font-normal text-foreground-secondary @xl:inline"
              >
                {lot.lotNumber}
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 font-mono text-caption font-normal text-muted @xl:hidden">
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
                      className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
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
                </p>
              </div>
              <div className="grid gap-0.5 @xl:text-end">
                <p className="text-caption whitespace-nowrap text-muted tabular-nums">
                  Lance
                  {lot.currentBid !== null && lot.currentBidObservedAt !== null ? (
                    <>
                      {" "}
                      · visto{" "}
                      <time dateTime={lot.currentBidObservedAt.toISOString()}>
                        {formatCompactDateTime(lot.currentBidObservedAt)}
                      </time>
                    </>
                  ) : null}
                </p>
                <p className="text-body-lg font-semibold text-foreground tabular-nums">
                  <Money value={lot.currentBid} />
                </p>
                <p className="text-caption text-muted tabular-nums">
                  {lot.limit === null ? (
                    "Sem limite fixado"
                  ) : lot.limit.isViable && lot.limit.maxBid !== null ? (
                    <>
                      Limite <Money value={lot.limit.maxBid} className="font-medium text-foreground-secondary" />
                    </>
                  ) : (
                    "Sem lance viável"
                  )}
                </p>
              </div>
              <div className="grid gap-2">
                <LimitProgress limit={lot.limit} bid={lot.currentBid} neutralWhenPositive={lot.fit === "above"} />
                <ProbableLine lot={lot} />
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > SHOWN ? (
        <ButtonLink href={ALL_FOLLOWED_HREF} variant="secondary" size="sm" className="w-fit">
          Ver todos os {items.length}
          <span className="sr-only"> lotes acompanhados</span>
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
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-1.5 text-caption text-muted">
      <span>
        Provável <Money value={price.median} className="font-medium text-foreground-secondary" /> (
        {priceEvidenceLabel(price)})
      </span>
      {fit !== null && FitIcon ? (
        <Badge variant={LIMIT_FIT_VARIANTS[fit]}>
          <FitIcon aria-hidden="true" className="size-3 shrink-0" />
          {PROBABLE_FIT_LABELS[fit]}
        </Badge>
      ) : null}
    </p>
  );
}

export function FollowedLotsSkeleton() {
  return (
    <div className="@container border-b border-border" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="grid grid-cols-1 items-center gap-x-5 gap-y-2 border-t border-border py-4 @xl:grid-cols-[3.5rem_minmax(0,1fr)_minmax(10rem,auto)_13rem]"
        >
          <Skeleton className="hidden h-4 w-10 @xl:block" />
          <div className="grid gap-1.5">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-3.5 w-36 max-w-full" />
          </div>
          <div className="grid gap-1 @xl:justify-items-end">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
