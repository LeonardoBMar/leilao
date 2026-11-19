import { Badge, Card, Money, Stat } from "@/components/ui";
import { compareToFixedLimit } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { LIMIT_FIT_LABELS, LIMIT_FIT_VARIANTS, marketValueOriginLabel, priceEvidenceLabel } from "@/lib/listing-labels";
import { cn } from "@/lib/utils";

import { updateCurrentBidAction } from "../actions";
import { toFixedLimit } from "../limit";
import type { LotDetail } from "../types";
import { CurrentBidForm } from "./current-bid-form";

type Tracking = NonNullable<LotDetail["tracking"]>;

/**
 * Lance e limite da ficha do lote (DESIGN.md §15.3, direção A): o número que decide é a folga até o limite; lance
 * atual e limite ao lado e a barra de proximidade. Com anúncio ligado, mercado, provável e fim do lote embaixo.
 */
export function BidLimitPanel({ lot, bidNote }: { lot: LotDetail; bidNote: string | undefined }) {
  const comparison = compareToFixedLimit(toFixedLimit(lot.limit), lot.currentBid);
  const maxBid = lot.limit?.isViable ? lot.limit.maxBid : null;
  const limitNote = lot.limit
    ? `Análise v${lot.limit.version}, fixada em ${formatDate(lot.limit.fixedAt)}`
    : "Sem análise fixada";

  return (
    <Card variant="summary" aria-label="Lance e limite" className="grid gap-5.5 p-5 md:p-8">
      <dl className="grid gap-6 sm:grid-cols-3 sm:items-end sm:gap-8">
        <div className="grid content-start gap-1.5">
          <Figure lot={lot} maxBid={maxBid} />
        </div>
        <Stat
          size="heading-2"
          label="Lance atual"
          note={bidNote}
          footer={
            <CurrentBidForm
              action={updateCurrentBidAction.bind(null, lot.id)}
              currentBid={lot.currentBid}
              isTracked={lot.tracking !== null}
            />
          }
        >
          <Money value={lot.currentBid} />
        </Stat>
        <Stat size="heading-2" label="Meu limite" note={limitNote}>
          {lot.limit && !lot.limit.isViable ? "Sem lance viável" : <Money value={maxBid} />}
        </Stat>
      </dl>

      {maxBid !== null && lot.currentBid !== null ? (
        <Proximity bid={lot.currentBid} maxBid={maxBid} isAbove={comparison === "above_limit"} />
      ) : null}

      {lot.tracking ? <ListingFacts tracking={lot.tracking} /> : null}
    </Card>
  );
}

/** Folga (ou excesso) quando há lance e limite; senão, o limite; sem análise, o convite para fixar uma. */
function Figure({ lot, maxBid }: { lot: LotDetail; maxBid: number | null }) {
  if (maxBid !== null && lot.currentBid !== null) {
    const gap = maxBid - lot.currentBid;
    return (
      <>
        <dt className="text-caption text-muted">{gap < 0 ? "Acima do seu limite em" : "Folga até o seu limite"}</dt>
        <dd
          className={cn(
            "text-display tabular-nums",
            gap < 0 ? "text-error" : gap === 0 ? "text-warning" : "text-success",
          )}
        >
          {formatBRL(cents(Math.abs(gap)))}
        </dd>
      </>
    );
  }
  if (maxBid !== null) {
    return (
      <>
        <dt className="text-caption text-muted">Meu limite</dt>
        <dd className="text-display text-foreground tabular-nums">{formatBRL(cents(maxBid))}</dd>
      </>
    );
  }
  return (
    <>
      <dt className="text-caption text-muted">Folga até o seu limite</dt>
      <dd className="text-heading-2 text-muted">{lot.limit ? "Sem lance viável" : "Sem limite fixado"}</dd>
    </>
  );
}

/** Barra do lance até o limite; a marca vertical é o limite. Decorativa: o texto abaixo diz o mesmo. */
function Proximity({ bid, maxBid, isAbove }: { bid: number; maxBid: number; isAbove: boolean }) {
  const percent = maxBid > 0 ? Math.round((bid / maxBid) * 100) : 100;
  return (
    <div className="grid gap-2">
      <div aria-hidden="true" className="relative h-2 rounded-full bg-primary-subtle">
        <div
          className={cn("h-2 rounded-full", isAbove ? "bg-error" : "bg-foreground")}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
        <div className="absolute -top-1.25 right-0 h-4.5 w-0.5 rounded-full bg-success" />
      </div>
      <p className="text-caption text-muted tabular-nums">Lance em {percent}% do limite</p>
    </div>
  );
}

/** O que o anúncio ligado diz além do lance: valor de mercado, provável lance final e fim do lote. */
function ListingFacts({ tracking }: { tracking: Tracking }) {
  const { market, price, fit, endsAt } = tracking;
  if (!market && !price && !endsAt) return null;
  return (
    <dl className="grid gap-4 border-t border-border-strong pt-5 sm:grid-cols-3 sm:gap-8">
      {market ? (
        <Stat size="lg" label={`Mercado (${marketValueOriginLabel(market.origin, market.refMonth) ?? "referência"})`}>
          <Money value={market.value} />
        </Stat>
      ) : null}
      {price ? (
        <Stat size="lg" label="Provável lance final">
          {price.kind === "insufficient" ? (
            <span className="text-muted">
              Sem base ({price.comparables} de {price.needed})
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <Money value={price.median} />
              <span className="text-caption text-muted">{priceEvidenceLabel(price)}</span>
              {fit === null ? null : <Badge variant={LIMIT_FIT_VARIANTS[fit]}>{LIMIT_FIT_LABELS[fit]}</Badge>}
            </span>
          )}
        </Stat>
      ) : null}
      {endsAt ? (
        <Stat size="lg" label="Encerra">
          {formatDateTime(endsAt)}
        </Stat>
      ) : null}
    </dl>
  );
}
