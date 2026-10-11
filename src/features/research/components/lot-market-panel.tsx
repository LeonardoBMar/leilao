import { ChartNoAxesColumn, ExternalLink } from "lucide-react";

import { ButtonLink, Section, SectionHeader, SectionTitle, Skeleton } from "@/components/ui";
import { DEFAULT_EVALUATE_FILTERS, type EvaluateComparable, targetFilters } from "@/domain/research/evaluate";
import { DEFAULT_RESEARCH_FILTERS } from "@/domain/research/filters";
import { remainingRise } from "@/domain/research/summary";
import { formatCompactBRL, formatDate, formatKm, formatRatio } from "@/lib/format";

import {
  CONFIDENCE_SHORT_LABELS,
  EVALUATE_LEVEL_LABELS,
  evaluateScopeLabel,
  salesLabel,
  SIMILARITY_LABELS,
} from "../labels";
import { getBidCurve, getEvaluation, getLotTarget } from "../queries";
import { evaluateHref } from "../search";
import type { EvaluateSaleView } from "../types";

/** Comparáveis mostrados na ficha; o resto fica no Avaliar. */
const SHOWN = 5;

const HOUR_MS = 60 * 60 * 1000;

/**
 * "Mercado deste lote" (docs/PLANO-MERCADO.md §6, T3.1): a faixa típica de arremate no mesmo recorte do preço provável
 * (modelo, ano ±1 e condição) e as 5 vendas mais parecidas, com "Ver todas" no Avaliar. Lote manual usa marca, modelo
 * e ano; com anúncio ligado, a versão, a origem e o km entram na semelhança. Com o anúncio aberto, quanto o lance
 * ainda costuma subir até o fim (T3.6).
 */
export async function LotMarketPanel({ lotId }: { lotId: string }) {
  const lot = await getLotTarget(lotId);
  if (lot === null) return null;
  const filters = targetFilters(lot.target, lot.id, []);
  const evaluation = await getEvaluation(filters, lot.target);
  const href = evaluateHref({ ...DEFAULT_EVALUATE_FILTERS, lot: lot.id });

  return (
    <Section aria-labelledby="mercado-do-lote">
      <SectionHeader>
        <SectionTitle id="mercado-do-lote">Mercado deste lote</SectionTitle>
        <ButtonLink href={href} variant="secondary" size="sm">
          <ChartNoAxesColumn aria-hidden="true" />
          {seeAllLabel(evaluation?.comparables.length ?? 0)}
        </ButtonLink>
      </SectionHeader>
      {evaluation === null ? (
        <p className="text-body text-muted">Sem marca e modelo reconhecidos para buscar vendas parecidas.</p>
      ) : (
        <div className="grid gap-4">
          <p className="text-caption text-muted">{evaluateScopeLabel(filters, evaluation.versionLabels)}</p>
          {evaluation.answer.kind === "band" ? (
            <div className="grid gap-1">
              <p className="text-caption text-muted">Faixa típica de arremate</p>
              <p className="text-heading-2 text-foreground tabular-nums">
                {formatCompactBRL(evaluation.answer.low)} a {formatCompactBRL(evaluation.answer.high)}
              </p>
              <p className="text-body text-foreground-secondary tabular-nums">
                Mediana {formatCompactBRL(evaluation.answer.median)}
                {evaluation.answer.marketRatio === null
                  ? ""
                  : ` (${formatRatio(evaluation.answer.marketRatio)} da FIPE)`}{" "}
                · {salesLabel(evaluation.answer.n)} {EVALUATE_LEVEL_LABELS[evaluation.level]} · confiança{" "}
                {CONFIDENCE_SHORT_LABELS[evaluation.answer.confidence]}
              </p>
            </div>
          ) : (
            <p className="text-body text-muted">
              {evaluation.answer.n === 0
                ? "Nenhuma venda neste recorte. No Avaliar dá para afrouxar o ano ou a condição."
                : `Só ${salesLabel(evaluation.answer.n)} neste recorte: pouco para uma faixa. No Avaliar dá para afrouxar o ano ou a condição.`}
            </p>
          )}
          {lot.endsAt === null ? null : <RemainingRise endsAt={lot.endsAt} />}
          {evaluation.comparables.length === 0 ? null : (
            <div className="grid gap-2">
              <h3 className="text-label text-muted">As vendas mais parecidas</h3>
              <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
                {evaluation.comparables.slice(0, SHOWN).map((item) => (
                  <ComparableLine key={item.sale.id} item={item} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

/**
 * "Com 12 h para o fim, o lance ainda sobe ~11%" (T3.6): a curva do lance de todo o catálogo (carros sem monta), que
 * pouco muda com o filtro, na marca de horas mais próxima do que falta. Só com amostra mínima na marca.
 */
async function RemainingRise({ endsAt }: { endsAt: Date }) {
  const { points } = await getBidCurve(DEFAULT_RESEARCH_FILTERS);
  const rise = remainingRise(points, (endsAt.getTime() - new Date().getTime()) / HOUR_MS);
  if (rise === null) return null;
  return (
    <p className="text-body text-foreground-secondary">
      Com {rise.hours} h para o fim, o lance ainda sobe {formatRatio(rise.rise)} até o final, na mediana de{" "}
      {salesLabel(rise.n)} do catálogo.
    </p>
  );
}

function ComparableLine({ item }: { item: EvaluateComparable<EvaluateSaleView> }) {
  const { sale, similarity } = item;
  const facts = [
    formatDate(sale.endsAt),
    sale.modelYear === null ? null : String(sale.modelYear),
    sale.mileageKm === null ? null : formatKm(sale.mileageKm),
    sale.state,
  ].filter((part) => part !== null);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 bg-surface px-3 py-2.5">
      <div className="grid min-w-0 gap-0.5">
        <a
          href={sale.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1 text-body text-foreground hover:underline"
        >
          <span className="truncate">{sale.title}</span>
          <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
        <p className="text-caption text-muted tabular-nums">
          {facts.join(" · ")}
          {similarity === null || similarity.reasons.length === 0
            ? ""
            : ` · ${similarity.reasons.map((reason) => SIMILARITY_LABELS[reason]).join(", ")}`}
        </p>
      </div>
      <p className="text-right text-body font-semibold text-foreground tabular-nums">
        {formatCompactBRL(sale.finalBid)}
      </p>
    </li>
  );
}

function seeAllLabel(count: number): string {
  if (count === 0) return "Abrir no Avaliar";
  return count === 1 ? "Ver a venda no Avaliar" : `Ver as ${salesLabel(count)}`;
}

export function LotMarketPanelSkeleton() {
  return <Skeleton className="h-72" aria-hidden="true" />;
}
