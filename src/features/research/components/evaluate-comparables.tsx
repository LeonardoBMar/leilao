import { Car, ChevronDown, ExternalLink, RotateCcw } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui";
import type { EvaluateComparable, EvaluateFilters } from "@/domain/research/evaluate";
import { ORIGIN_LABELS } from "@/features/listings/filter-labels";
import { formatCompactBRL, formatDate, formatKm, formatRatio } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CONFIDENCE_SHORT_LABELS, salesLabel, SIMILARITY_LABELS } from "../labels";
import { evaluateHref } from "../search";
import type { EvaluateSaleView, EvaluationView } from "../types";
import { ResearchBlock } from "./research-block";
import { ResearchNavButton } from "./research-nav-button";

/** Linhas abertas de início; o resto fica em "Ver as outras". */
const SHOWN = 12;

/**
 * Vendas do recorte (docs/PLANO-MERCADO.md §5.2), da mais parecida com o lote alvo (ou da mais recente) para baixo,
 * cada uma com o motivo da semelhança. "Tirar da conta" grava a venda em `fora` na URL e o servidor refaz a faixa; a
 * venda continua na lista, marcada, para poder voltar. O link fica compartilhável.
 */
export function EvaluateComparables({ filters, evaluation }: { filters: EvaluateFilters; evaluation: EvaluationView }) {
  const { answer, comparables, excluded } = evaluation;
  const shown = comparables.slice(0, SHOWN);
  const rest = comparables.slice(SHOWN);
  return (
    <ResearchBlock
      id="comparaveis"
      title={`Vendas do recorte (${comparables.length})`}
      description={
        excluded > 0
          ? `${salesLabel(excluded)} fora da conta por você. Tire da conta uma venda que não se parece com o veículo (outra versão, batida) e a faixa é refeita.`
          : "Tire da conta uma venda que não se parece com o veículo (outra versão, batida) e a faixa é refeita."
      }
    >
      <p role="status" className="sr-only">
        {excluded > 0
          ? answer.kind === "band"
            ? `${salesLabel(excluded)} fora da conta. Faixa recalculada: ${formatCompactBRL(answer.low)} a ${formatCompactBRL(answer.high)}, confiança ${CONFIDENCE_SHORT_LABELS[answer.confidence]}.`
            : `${salesLabel(excluded)} fora da conta. Restam ${salesLabel(answer.n)} na conta.`
          : `Todas as ${salesLabel(comparables.length)} estão na conta.`}
      </p>
      {excluded > 0 ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-strong bg-surface-subtle px-3.5 py-2.5 text-label text-foreground shadow-xs xl:top-16">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            {answer.kind === "band" ? (
              <>
                <span>
                  Faixa recalculada:{" "}
                  <span className="font-semibold">
                    {formatCompactBRL(answer.low)} a {formatCompactBRL(answer.high)}
                  </span>
                </span>
                <span className="text-muted">
                  · mediana {formatCompactBRL(answer.median)}
                  {answer.marketRatio === null ? "" : ` (${formatRatio(answer.marketRatio)} da FIPE)`} ·{" "}
                  {salesLabel(answer.n)}
                </span>
                {answer.confidence === "low" ? (
                  <Badge variant="warning">Confiança {CONFIDENCE_SHORT_LABELS[answer.confidence]}</Badge>
                ) : (
                  <span className="text-muted">· confiança {CONFIDENCE_SHORT_LABELS[answer.confidence]}</span>
                )}
              </>
            ) : (
              <span>
                Restam {salesLabel(answer.n)} na conta{" "}
                <span className="text-muted">(a faixa precisa de {answer.needed}).</span>
              </span>
            )}
          </div>
          <ResearchNavButton
            href={evaluateHref({ ...filters, excluded: [] })}
            focusTargetId="comparaveis-titulo"
            variant="secondary"
            size="sm"
          >
            <RotateCcw aria-hidden="true" />
            Voltar todas para a conta
          </ResearchNavButton>
        </div>
      ) : null}
      <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
        {shown.map((item) => (
          <ComparableRow key={item.sale.id} item={item} filters={filters} />
        ))}
      </ul>
      {rest.length === 0 ? null : (
        <details className="group">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-label text-accent hover:underline [&::-webkit-details-marker]:hidden">
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform duration-150 group-open:rotate-180"
            />
            Ver as outras {rest.length} vendas
          </summary>
          <ul className="mt-3 grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {rest.map((item) => (
              <ComparableRow key={item.sale.id} item={item} filters={filters} />
            ))}
          </ul>
        </details>
      )}
    </ResearchBlock>
  );
}

function ComparableRow({ item, filters }: { item: EvaluateComparable<EvaluateSaleView>; filters: EvaluateFilters }) {
  const { sale, excluded, similarity } = item;
  const toggled = excluded ? filters.excluded.filter((id) => id !== sale.id) : [...filters.excluded, sale.id];
  const facts = [
    sale.modelYear === null ? null : String(sale.modelYear),
    sale.mileageKm === null ? "km não informado" : formatKm(sale.mileageKm),
    sale.origin === null ? null : ORIGIN_LABELS[sale.origin],
    sale.city !== null && sale.state !== null ? `${sale.city}/${sale.state}` : sale.state,
    sale.source,
  ].filter((part) => part !== null);
  return (
    <li
      className={cn(
        "grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-2 bg-surface p-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto]",
        excluded && "bg-surface-subtle",
      )}
    >
      <div className="relative row-span-2 aspect-4/3 overflow-hidden rounded-sm bg-surface-subtle sm:row-span-1">
        {sale.photoUrl ? (
          <Image src={sale.photoUrl} alt="" fill unoptimized loading="lazy" sizes="5rem" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-subtle">
            <Car aria-hidden="true" className="size-5" />
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-1">
        <p title={sale.title} className="line-clamp-2 text-body font-medium text-foreground">
          <span className="text-muted tabular-nums">{formatDate(sale.endsAt)} · </span>
          {sale.title}
        </p>
        <p className="text-caption text-muted tabular-nums">{facts.join(" · ")}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body tabular-nums">
          <span className={cn("font-semibold text-foreground", excluded && "line-through")}>
            {formatCompactBRL(sale.finalBid)}
          </span>
          {sale.marketValue === null ? null : (
            <span className="text-caption text-muted">{formatRatio(sale.finalBid / sale.marketValue)} da FIPE</span>
          )}
          {excluded ? <Badge variant="outline">Fora da conta</Badge> : null}
        </p>
        {similarity === null || similarity.reasons.length === 0 ? null : (
          <p className="text-caption text-muted">
            {similarity.reasons.map((reason) => SIMILARITY_LABELS[reason]).join(" · ")}
          </p>
        )}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end">
        <ResearchNavButton
          href={evaluateHref({ ...filters, excluded: toggled })}
          variant={excluded ? "secondary" : "ghost"}
          size="sm"
          aria-label={`${excluded ? "Voltar para a conta" : "Tirar da conta"}: ${sale.title}, ${formatDate(sale.endsAt)}`}
        >
          {excluded ? "Voltar para a conta" : "Tirar da conta"}
        </ResearchNavButton>
        <a
          href={sale.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-label text-accent hover:underline sm:min-h-9"
        >
          Anúncio
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </div>
    </li>
  );
}
