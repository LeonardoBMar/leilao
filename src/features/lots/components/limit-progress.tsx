import { compareToFixedLimit } from "@/domain/finance/calculator";
import { type Cents, cents } from "@/domain/money";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { LotLimit } from "../types";
import { toFixedLimit } from "./limit-badge";

/**
 * Lance atual frente ao limite em uma linha de lista (DESIGN.md §15.1): barra até o limite e a diferença em texto.
 * A barra é decorativa; o texto sempre diz a situação (cor nunca sozinha).
 */
export function LimitProgress({ limit, bid }: { limit: LotLimit | null; bid: Cents | null }) {
  const comparison = compareToFixedLimit(toFixedLimit(limit), bid);
  const maxBid = limit?.isViable ? limit.maxBid : null;

  if (maxBid === null) {
    return (
      <Track dashed>
        <span className="text-caption text-muted">{limit ? "Sem lance viável" : "Fixe uma análise para comparar"}</span>
      </Track>
    );
  }
  if (bid === null) {
    return (
      <Track percent={0}>
        <span className="text-caption text-muted">Sem lance observado</span>
      </Track>
    );
  }

  const gap = maxBid - bid;
  const text =
    comparison === "at_limit"
      ? "No limite"
      : `${formatBRL(cents(Math.abs(gap)))} ${gap > 0 ? "abaixo" : "acima"} do limite`;
  return (
    <Track percent={maxBid > 0 ? (bid / maxBid) * 100 : 100} isAbove={gap < 0}>
      <span
        className={cn(
          "text-caption font-medium tabular-nums",
          gap > 0 ? "text-success" : gap === 0 ? "text-warning" : "text-error",
        )}
      >
        {text}
      </span>
    </Track>
  );
}

type TrackProps = { percent?: number; dashed?: boolean; isAbove?: boolean; children: React.ReactNode };

function Track({ percent = 0, dashed = false, isAbove = false, children }: TrackProps) {
  return (
    <div className="grid gap-1.5">
      {dashed ? (
        <div aria-hidden="true" className="my-0.75 border-t-2 border-dashed border-border-strong" />
      ) : (
        <div aria-hidden="true" className="h-1.5 rounded-full bg-primary-subtle">
          <div
            className={cn("h-1.5 rounded-full", isAbove ? "bg-error" : "bg-foreground")}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
