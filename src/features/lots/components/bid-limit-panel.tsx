import { Card, Money } from "@/components/ui";
import { compareToFixedLimit } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { updateCurrentBidAction } from "../actions";
import type { LotDetail } from "../types";
import { CurrentBidForm } from "./current-bid-form";
import { LimitBadge, toFixedLimit } from "./limit-badge";

/**
 * Lance e limite da ficha do lote (DESIGN.md §15.3, direção A): o número que decide é a folga até o limite; lance
 * atual e limite ao lado, a barra de proximidade e o formulário do novo lance.
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
          {comparison === "unavailable" ? null : (
            <dd>
              <LimitBadge limit={lot.limit} bid={lot.currentBid} />
            </dd>
          )}
        </div>
        <Value label="Lance atual" note={bidNote}>
          <Money value={lot.currentBid} />
        </Value>
        <Value label="Meu limite" note={limitNote}>
          {lot.limit && !lot.limit.isViable ? "Sem lance viável" : <Money value={maxBid} />}
        </Value>
      </dl>

      {maxBid !== null && lot.currentBid !== null ? (
        <Proximity bid={lot.currentBid} maxBid={maxBid} isAbove={comparison === "above_limit"} />
      ) : null}

      <div className="border-t border-border-strong pt-5">
        <CurrentBidForm action={updateCurrentBidAction.bind(null, lot.id)} currentBid={lot.currentBid} />
      </div>
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

function Value({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-heading-2 text-foreground">{children}</dd>
      {note ? <dd className="text-caption text-muted">{note}</dd> : null}
    </div>
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
      <p className="flex justify-between gap-4 text-caption text-muted tabular-nums">
        <span>Lance atual em {percent}% do limite</span>
        <span>Limite {formatBRL(cents(maxBid))}</span>
      </p>
    </div>
  );
}
