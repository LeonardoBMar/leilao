import { ChevronDown, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { Badge, Card } from "@/components/ui";
import { type EvaluateFilters, loosened } from "@/domain/research/evaluate";
import { formatCompactBRL, formatDate, formatRatio } from "@/lib/format";

import { CONFIDENCE_SHORT_LABELS, EVALUATE_LEVEL_LABELS, evaluateScopeLabel, loosenLabel, salesLabel } from "../labels";
import { evaluateHref } from "../search";
import type { EvaluationView } from "../types";
import { ResearchNavButton } from "./research-nav-button";

/** Com mais anos-modelo que isto sem filtro de ano, a faixa avisa que mistura anos. */
const MIXED_YEARS = 3;

/**
 * Resposta do Avaliar (docs/PLANO-MERCADO.md §5.1): a faixa típica de arremate em R$ antes de qualquer gráfico, com a
 * mediana, o % da FIPE, o `n`, o período, a confiança e o grupo de onde vieram as vendas. Com menos de 5
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
    loosen.length === 0 && excluded === 0 ? null : (
      <div className="flex flex-wrap gap-2">
        {excluded > 0 ? (
          <ResearchNavButton href={evaluateHref({ ...filters, excluded: [] })} variant="secondary" size="sm">
            <RotateCcw aria-hidden="true" />
            Voltar as {salesLabel(excluded)} excluídas para a conta
          </ResearchNavButton>
        ) : null}
        {loosen.map((option) => (
          <ResearchNavButton
            key={option.change}
            href={evaluateHref(loosened(filters, option.change))}
            variant="secondary"
            size="sm"
          >
            {loosenLabel(option)}
          </ResearchNavButton>
        ))}
      </div>
    );

  return (
    <section aria-labelledby="resposta-titulo">
      <Card variant="summary" className="grid gap-4 p-5 md:p-6">
        <p className="text-label text-muted">{scope}</p>
        {answer.kind === "band" ? (
          <>
            <div className="grid gap-1">
              <h2 id="resposta-titulo" className="text-label text-muted">
                Faixa típica de arremate
              </h2>
              <p className="text-display text-foreground tabular-nums">
                {formatCompactBRL(answer.low)} a {formatCompactBRL(answer.high)}
              </p>
            </div>
            <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-body text-foreground tabular-nums">
              <Fact label="Mediana">
                <span className="font-semibold">{formatCompactBRL(answer.median)}</span>
              </Fact>
              {answer.marketRatio === null ? null : (
                <Fact label="Da FIPE">
                  <span className="font-semibold">{formatRatio(answer.marketRatio)}</span>
                </Fact>
              )}
              <Fact label="Confiança">
                {answer.confidence === "low" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Badge variant="warning">{CONFIDENCE_SHORT_LABELS[answer.confidence]}</Badge>
                    <span className="text-caption text-warning">faixa larga, erro ~25%</span>
                  </span>
                ) : (
                  <span className="font-semibold">{CONFIDENCE_SHORT_LABELS[answer.confidence]}</span>
                )}
              </Fact>
            </dl>
            <p className="text-caption text-muted tabular-nums">
              Base: {salesLabel(answer.n)} {EVALUATE_LEVEL_LABELS[level]} ({formatDate(answer.from)} a{" "}
              {formatDate(answer.to)}){excluded > 0 ? `, sem as ${salesLabel(excluded)} que você tirou` : ""}.
            </p>
            {filters.yearFrom === null && filters.yearTo === null && evaluation.years.length > MIXED_YEARS ? (
              <div className="grid gap-2">
                <p className="text-caption text-warning">
                  Sem filtro de ano, a faixa junta {evaluation.years.length} anos-modelo. Escolha um ano para uma faixa
                  mais justa:
                </p>
                <div className="flex flex-wrap gap-2">
                  {evaluation.years
                    .toSorted((a, b) => b.n - a.n || b.year - a.year)
                    .slice(0, 3)
                    .map(({ year, n }) => (
                      <ResearchNavButton
                        key={year}
                        href={evaluateHref({ ...filters, yearFrom: year, yearTo: year })}
                        variant="secondary"
                        size="sm"
                      >
                        Só {year} ({salesLabel(n)})
                      </ResearchNavButton>
                    ))}
                </div>
              </div>
            ) : null}
            <details className="group text-caption text-muted">
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 font-medium text-foreground-secondary hover:text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  aria-hidden="true"
                  className="size-3.5 transition-transform duration-150 group-open:rotate-180"
                />
                Como calculamos
              </summary>
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
                <p>
                  &ldquo;Sem monta declarada&rdquo; significa que a fonte não informou a classificação de avaria — não
                  equivale a veículo sem sinistro.
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
