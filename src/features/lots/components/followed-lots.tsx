import Link from "next/link";

import { Badge, ButtonLink, EmptyState, Money, Skeleton } from "@/components/ui";
import { LIMIT_FIT_LABELS, LIMIT_FIT_VARIANTS } from "@/features/listings/labels";
import { formatDate, formatShortDateTime } from "@/lib/format";

import { getFollowedLotsOverview } from "../queries";
import type { FollowedLotItem } from "../types";
import { LimitProgress } from "./limit-progress";

const SHOWN = 8;
const ALL_FOLLOWED_HREF = "/minhas-analises?acompanhados=1&resultado=sem";

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
        description="Marque um lote para acompanhar seu lance e limite aqui."
        action={
          <ButtonLink href="/minhas-analises" variant="secondary">
            Ver minhas análises
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid gap-3">
      <ul className="border-b border-border">
        {items.slice(0, SHOWN).map((lot) => (
          <li
            key={lot.id}
            className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-5 gap-y-3 border-t border-border py-4 md:grid-cols-[3.5rem_minmax(0,1fr)_9.5rem_12rem]"
          >
            <span className="font-mono text-label font-normal text-foreground-secondary">{lot.lotNumber}</span>
            <div className="min-w-0">
              <Link href={`/lotes/${lot.id}`} className="font-semibold text-foreground hover:underline">
                {lot.brand} {lot.model} {lot.modelYear}
              </Link>
              <p className="truncate text-caption text-muted">
                {lot.auction.name} ·{" "}
                {lot.endsAt ? `encerra ${formatShortDateTime(lot.endsAt)}` : formatDate(lot.auction.startsAt)}
              </p>
            </div>
            <div className="col-start-2 md:col-start-auto md:text-right">
              <p className="text-body-lg font-medium text-foreground">
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
            <div className="col-start-2 grid gap-1.5 md:col-start-auto">
              <LimitProgress limit={lot.limit} bid={lot.currentBid} />
              <ProbableLine lot={lot} />
            </div>
          </li>
        ))}
      </ul>
      {items.length > SHOWN ? (
        <Link href={ALL_FOLLOWED_HREF} className="w-fit text-label text-accent hover:underline">
          Ver todos os {items.length} lotes acompanhados
        </Link>
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
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
      <span>
        Provável <Money value={price.median} className="font-medium text-foreground-secondary" /> (n={price.n})
      </span>
      {fit === null ? null : <Badge variant={LIMIT_FIT_VARIANTS[fit]}>{LIMIT_FIT_LABELS[fit]}</Badge>}
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
