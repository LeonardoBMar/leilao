import { ChevronRight, CircleAlert, CircleCheck, Clock, type LucideIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Badge, ButtonLink, EmptyState, Money, Skeleton } from "@/components/ui";
import type { LimitFit } from "@/domain/listings/estimates";
import { formatDate, formatShortDateTime } from "@/lib/format";
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
  const { items } = await getFollowedLotsOverview();

  if (items.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhum lote acompanhado"
        description="Adicione um lote de Leilões à análise (ele já entra acompanhado) para ver lance e limite aqui."
        action={
          <ButtonLink href="/leiloes" variant="secondary">
            Ver leilões
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
          return (
            <li
              key={lot.id}
              className="grid grid-cols-1 items-center gap-x-5 gap-y-3 border-t border-border py-4 @2xl:grid-cols-[3.5rem_minmax(0,1fr)_9.5rem_12rem]"
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
                    title={lotTitle}
                    className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent"
                  >
                    <span className="truncate">{lotTitle}</span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-foreground"
                    />
                  </Link>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted">
                  <span className="min-w-0 truncate" title={lot.auction.name}>
                    {lot.auction.name}
                  </span>
                  <span aria-hidden="true" className="text-border-strong">
                    ·
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                    <Clock aria-hidden="true" className="size-3 shrink-0 text-muted-subtle" />
                    {lot.endsAt ? (
                      <>
                        encerra <time dateTime={lot.endsAt.toISOString()}>{formatShortDateTime(lot.endsAt)}</time>
                      </>
                    ) : (
                      <time dateTime={lot.auction.startsAt.toISOString()}>{formatDate(lot.auction.startsAt)}</time>
                    )}
                  </span>
                </p>
              </div>
              <div className="flex items-stretch gap-2.5 @2xl:flex-row-reverse @2xl:justify-start">
                <span aria-hidden="true" className="flex flex-col items-center py-1.5">
                  <span className="size-1.5 rounded-full bg-foreground" />
                  <span className="my-0.5 w-px flex-1 bg-border-strong" />
                  <span
                    className={cn(
                      "size-1.5 rounded-none border",
                      lot.limit?.isViable && lot.limit.maxBid !== null
                        ? "border-foreground-secondary bg-surface"
                        : "border-dashed border-muted-subtle",
                    )}
                  />
                </span>
                <div className="@2xl:text-end">
                  <p className="text-body-lg font-medium text-foreground">
                    <span className="sr-only">Lance atual: </span>
                    <Money value={lot.currentBid} />
                  </p>
                  <p className="text-caption text-muted">
                    {lot.limit?.isViable && lot.limit.maxBid !== null ? (
                      <>
                        de <Money value={lot.limit.maxBid} />
                      </>
                    ) : (
                      "sem limite"
                    )}
                  </p>
                </div>
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
