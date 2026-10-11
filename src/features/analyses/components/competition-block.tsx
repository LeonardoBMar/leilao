import Link from "next/link";

import type { Cents } from "@/domain/money";
import { limitPosition } from "@/domain/research/evaluate";
import type { LotMarketReference } from "@/features/research/types";
import { formatBRL, formatCompactBRL } from "@/lib/format";

import { limitPositionText } from "../labels";

/**
 * Concorrência (docs/PLANO-MERCADO.md §8, T3.3): quanto outros pagaram por veículos parecidos e onde o lance máximo
 * (e o lance simulado) fica entre eles. Referência descritiva, sem cor de bom ou ruim: não muda o lance máximo, que
 * vem do valor de revenda. Recalcula a cada mudança das premissas e da simulação.
 */
export function CompetitionBlock({
  market,
  maxBid,
  bid,
  note,
}: {
  market: LotMarketReference;
  maxBid: Cents | null;
  bid: Cents | null;
  /** Linha sobre a época das vendas (análise fixada). */
  note?: string;
}) {
  const bids = market.sales.map((sale) => sale.finalBid);
  const atLimit = maxBid === null ? null : limitPosition(maxBid, bids);
  const atBid = bid === null || bid === maxBid ? null : limitPosition(bid, bids);
  const { band } = market;

  return (
    <section aria-labelledby="concorrencia" className="grid gap-2.5 border-t border-border-strong pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="concorrencia" className="text-label text-foreground">
          Concorrência
        </h2>
        <Link href={market.href} className="text-label text-accent hover:underline">
          Ver as vendas
        </Link>
      </div>
      {bids.length === 0 ? (
        <p className="text-body text-muted">Nenhuma venda parecida no catálogo ainda.</p>
      ) : (
        <div className="grid gap-1.5 text-body text-foreground-secondary tabular-nums" aria-live="polite">
          <p>
            {band === null
              ? `Só ${bids.length === 1 ? "1 venda parecida" : `${bids.length} vendas parecidas`}: pouco para uma faixa.`
              : `Faixa típica de arremate: ${formatCompactBRL(band.low)} a ${formatCompactBRL(band.high)}, mediana ${formatCompactBRL(band.median)}.`}
          </p>
          {atLimit === null || maxBid === null ? null : (
            <p>
              Seu lance máximo de <span className="text-foreground">{formatBRL(maxBid)}</span>{" "}
              {limitPositionText(atLimit)}.
            </p>
          )}
          {atBid === null || bid === null ? null : (
            <p>
              O lance simulado de <span className="text-foreground">{formatBRL(bid)}</span> {limitPositionText(atBid)}.
            </p>
          )}
        </div>
      )}
      <p className="text-caption text-muted">
        {market.scope}. {note ?? "Quanto outros pagaram; não muda o lance máximo, que vem do valor de venda."}
      </p>
    </section>
  );
}
