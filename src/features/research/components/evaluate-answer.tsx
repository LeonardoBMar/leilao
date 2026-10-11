import type { ReactNode } from "react";

import { ButtonLink, Card } from "@/components/ui";
import { type EvaluateFilters, familyLabel, loosened } from "@/domain/research/evaluate";
import { vehicleLabel } from "@/domain/research/filters";
import { ORIGIN_LABELS } from "@/features/listings/filter-labels";
import { formatCompactBRL, formatDate, formatRatio } from "@/lib/format";

import {
  CONDITION_LABELS,
  CONFIDENCE_SHORT_LABELS,
  EVALUATE_LEVEL_LABELS,
  loosenLabel,
  mileageLabel,
  salesLabel,
  yearRangeLabel,
} from "../labels";
import { evaluateHref } from "../search";
import type { EvaluationView } from "../types";

/** Com mais anos-modelo que isto sem filtro de ano, a faixa avisa que mistura anos. */
const MIXED_YEARS = 3;

/** O recorte em palavras: "Chevrolet Onix · família ONIX PLUS · 2022 a 2024 · Sem monta declarada". */
export function evaluateScopeLabel(filters: EvaluateFilters, versionLabels: Readonly<Record<string, string>>): string {
  return [
    filters.vehicle === null ? null : vehicleLabel(filters.vehicle),
    filters.version === null ? null : `versão ${versionLabels[filters.version] ?? filters.version}`,
    filters.version !== null || filters.family === null ? null : `família ${familyLabel(filters.family)}`,
    yearRangeLabel(filters),
    filters.maxKm === null ? null : `até ${mileageLabel(filters.maxKm)}`,
    CONDITION_LABELS[filters.condition],
    filters.origin === null ? null : ORIGIN_LABELS[filters.origin],
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/**
 * Resposta do Avaliar (docs/PLANO-MERCADO.md §5.1): a faixa típica de arremate em R$ antes de qualquer gráfico, com a
 * mediana, o % do valor de mercado, o `n`, o período, a confiança e o grupo de onde vieram as vendas. Com menos de 5
 * vendas, diz quantas há e oferece afrouxar um filtro (com quantas vendas ficariam).
 */
export function EvaluateAnswer({
  filters,
  evaluation,
  actions,
}: {
  filters: EvaluateFilters;
  evaluation: EvaluationView;
  /** Monitor e catálogo, compostos pela rota. */
  actions: ReactNode;
}) {
  const { answer, excluded, loosen, level } = evaluation;
  const scope = evaluateScopeLabel(filters, evaluation.versionLabels);
  const loosenLinks =
    loosen.length === 0 ? null : (
      <div className="flex flex-wrap gap-2">
        {loosen.map((option) => (
          <ButtonLink
            key={option.change}
            href={evaluateHref(loosened(filters, option.change))}
            scroll={false}
            variant="secondary"
            size="sm"
          >
            {loosenLabel(option)}
          </ButtonLink>
        ))}
      </div>
    );

  return (
    <section aria-labelledby="resposta-titulo">
      <Card variant="metric" className="grid gap-4 p-5 md:p-6">
        <p className="text-label text-muted">{scope}</p>
        {answer.kind === "band" ? (
          <>
            <div className="grid gap-1">
              <h2 id="resposta-titulo" className="text-label text-muted">
                Faixa típica de arremate
              </h2>
              <p className="text-heading-1 text-foreground tabular-nums">
                {formatCompactBRL(answer.low)} a {formatCompactBRL(answer.high)}
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-5 gap-y-2 text-body text-foreground-secondary tabular-nums">
              <Fact label="Mediana">{formatCompactBRL(answer.median)}</Fact>
              {answer.marketRatio === null ? null : (
                <Fact label="Do valor de mercado">{formatRatio(answer.marketRatio)}</Fact>
              )}
              <Fact label="Base">{salesLabel(answer.n)}</Fact>
              <Fact label="Período">
                {formatDate(answer.from)} a {formatDate(answer.to)}
              </Fact>
              <Fact label="Confiança">{CONFIDENCE_SHORT_LABELS[answer.confidence]}</Fact>
            </dl>
            <p className="text-caption text-muted">
              Vendas da {EVALUATE_LEVEL_LABELS[level]}
              {excluded > 0 ? `, sem as ${salesLabel(excluded)} que você tirou` : ""}.
            </p>
            {filters.yearFrom === null && filters.yearTo === null && evaluation.years.length > MIXED_YEARS ? (
              <p className="text-caption text-warning">
                Sem filtro de ano, a faixa junta {evaluation.years.length} anos-modelo. Escolha o ano para uma faixa
                mais justa.
              </p>
            ) : null}
            <details className="text-caption text-muted">
              <summary className="cursor-pointer hover:text-foreground">Como calculamos</summary>
              <div className="mt-2 grid max-w-3xl gap-1.5">
                <p>
                  Lances finais das vendas arrematadas no catálogo nos últimos 12 meses, de qualquer região, dentro do
                  recorte acima. A faixa é onde deve cair metade das próximas vendas: com poucas vendas ela se alarga,
                  porque a amostra ainda não mostra toda a variação.
                </p>
                <p>
                  A confiança olha o número de vendas e a largura da faixa: alta com 20 vendas ou mais e faixa estreita;
                  baixa com faixa larga. Sem descrição do estado de cada veículo, a mediana erra em torno de 13% com
                  confiança alta e 25% com confiança baixa.
                </p>
              </div>
            </details>
          </>
        ) : (
          <div className="grid gap-3">
            <h2 id="resposta-titulo" className="text-heading-3 text-foreground">
              {answer.n === 0
                ? "Nenhuma venda neste recorte"
                : `Só ${salesLabel(answer.n)} neste recorte: pouco para uma faixa`}
            </h2>
            <p className="text-body text-muted">
              {answer.n === 0
                ? "Afrouxe um filtro para ver as vendas parecidas."
                : `A faixa precisa de ${answer.needed} vendas. As que existem aparecem abaixo, uma a uma.`}
            </p>
            {loosenLinks}
          </div>
        )}
        {actions}
      </Card>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-caption text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
