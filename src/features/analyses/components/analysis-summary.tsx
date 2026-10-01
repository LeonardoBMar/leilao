"use client";

import { useState } from "react";

import { Badge, Card, CardContent, CardHeader, CardTitle, CurrencyInput, Money } from "@/components/ui";
import { compareToLimit, differenceToLimit, simulateBid } from "@/domain/finance/calculator";
import { type Cents, cents, parseBRL } from "@/domain/money";
import { formatBRL } from "@/lib/format";
import { LIMIT_COMPARISON_LABELS, LIMIT_COMPARISON_VARIANTS } from "@/lib/limit-comparison";
import { cn } from "@/lib/utils";

import { FIELD_LABELS } from "../labels";
import type { SummaryModel } from "../summary-model";

type AnalysisSummaryProps = {
  model: SummaryModel;
  /** Lance atual do lote: valor inicial da simulação. */
  currentBid: Cents | null;
};

/**
 * Resumo da análise (DESIGN.md §15.4): premissas, lance máximo como saída principal e simulação de lance.
 * A simulação é exploratória: não altera o lance atual do lote nem é gravada (SPEC RF-04). Renderizar fora do
 * <form> da análise, para o lance simulado nunca ser enviado.
 */
export function AnalysisSummary({ model, currentBid }: AnalysisSummaryProps) {
  const { outcome, complete } = model;
  const [bidText, setBidText] = useState(currentBid === null ? "" : (currentBid / 100).toFixed(2).replace(".", ","));
  const parsedBid = bidText.trim() === "" ? null : parseBRL(bidText);
  const bid = parsedBid !== null && parsedBid >= 0 ? parsedBid : null;
  const simulation = complete && bid !== null ? simulateBid(complete, bid) : null;
  const comparison = compareToLimit(outcome, bid);

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Resumo</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <section aria-label="Lance máximo" className="grid gap-1">
          <p className="text-label text-foreground-secondary">Lance máximo</p>
          {outcome.kind === "viable" ? (
            <p className="text-display text-primary tabular-nums">{formatBRL(outcome.maxBid)}</p>
          ) : outcome.kind === "not_viable" ? (
            <p className="text-heading-2 text-foreground">Sem lance viável com estas premissas</p>
          ) : (
            <div className="grid gap-1">
              <p className="text-heading-3 text-muted">Faltam dados para calcular</p>
              <p className="text-caption text-muted">
                Pendente: {outcome.missing.map((field) => FIELD_LABELS[field]).join(", ")}.
              </p>
            </div>
          )}
          <p className="text-caption text-muted">
            Maior lance que preserva a margem desejada. Não considera incrementos mínimos da plataforma.
          </p>
        </section>

        {complete ? (
          <dl className="grid gap-2 border-t border-border pt-4 text-body">
            <Row label="Valor de venda esperado">
              <Money value={complete.marketValue} />
            </Row>
            <Row label="Custos fixos">
              <Money value={complete.fixedCosts} />
            </Row>
            {outcome.kind === "viable" ? (
              <Row label="Comissão no limite">
                <Money value={outcome.commissionAtMaxBid} />
              </Row>
            ) : null}
            <Row label="Reserva para imprevistos">
              <Money value={complete.riskReserve} />
            </Row>
            <Row label="Margem desejada">
              <Money value={complete.desiredMargin} />
            </Row>
            {outcome.kind === "viable" ? (
              <>
                <Row label="Custo total no limite" strong>
                  <Money value={outcome.totalAtMaxBid} />
                </Row>
                <Row label="Margem estimada no limite" strong>
                  <MarginValue value={outcome.marginAtMaxBid} />
                </Row>
              </>
            ) : null}
          </dl>
        ) : null}

        <section aria-label="Simulação de lance" className="grid gap-4 border-t border-border pt-4">
          <CurrencyInput
            label="Lance simulado"
            helperText="Não altera o lance atual do lote."
            value={bidText}
            onChange={(event) => setBidText(event.target.value)}
          />
          {simulation ? (
            <dl className="grid gap-2 text-body" aria-live="polite">
              <Row label="Comissão">
                <Money value={simulation.commission} />
              </Row>
              <Row label="Custos fora do lance">
                <Money value={simulation.costsBesidesBid} />
              </Row>
              <Row label="Custo total estimado" strong>
                <Money value={simulation.totalCost} />
              </Row>
              <Row label="Margem estimada" strong>
                <MarginValue value={simulation.estimatedMargin} />
              </Row>
              {outcome.kind === "viable" ? (
                <Row label="Diferença para o limite">
                  <DifferenceText value={differenceToLimit(outcome.maxBid, simulation.bid)} />
                </Row>
              ) : null}
            </dl>
          ) : null}
          <div>
            <Badge variant={LIMIT_COMPARISON_VARIANTS[comparison]}>{LIMIT_COMPARISON_LABELS[comparison]}</Badge>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function Row({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-foreground-secondary", strong && "font-semibold text-foreground")}>{label}</dt>
      <dd className={cn("text-right", strong && "font-semibold")}>{children}</dd>
    </div>
  );
}

/** Margem positiva em `success` só com o rótulo; negativa em `error` com sinal explícito (DESIGN.md §3.1). */
function MarginValue({ value }: { value: Cents }) {
  return (
    <span className={cn("tabular-nums", value > 0 && "text-success", value < 0 && "text-error")}>
      {value < 0 ? `− ${formatBRL(cents(Math.abs(value)))}` : formatBRL(value)}
    </span>
  );
}

/** Diferença com sinal e frase completa (DESIGN.md §15.5). */
function DifferenceText({ value }: { value: Cents }) {
  if (value === 0) return <span>No limite</span>;
  const amount = formatBRL(cents(Math.abs(value)));
  return value > 0 ? (
    <span className="tabular-nums">{amount} abaixo do limite</span>
  ) : (
    <span className="text-error tabular-nums">{amount} acima do limite</span>
  );
}
