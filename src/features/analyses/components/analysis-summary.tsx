"use client";

import { useState } from "react";

import { Badge, Button, Card, CurrencyInput, Money } from "@/components/ui";
import { calculateBreakEvenBid, compareToLimit, differenceToLimit, simulateBid } from "@/domain/finance/calculator";
import { type Cents, cents, MAX_CENTS, parseBRL } from "@/domain/money";
import type { LotMarketReference } from "@/features/research/types";
import { formatBRL, formatMoneyInput } from "@/lib/format";
import { LIMIT_COMPARISON_LABELS, LIMIT_COMPARISON_VARIANTS } from "@/lib/limit-comparison";
import { cn } from "@/lib/utils";

import { FIELD_LABELS } from "../labels";
import type { SummaryModel } from "../summary-model";
import { CompetitionBlock } from "./competition-block";

type AnalysisSummaryProps = {
  model: SummaryModel;
  /** Lance atual do lote: valor inicial da simulação. */
  currentBid: Cents | null;
  /** Vendas parecidas do lote, para o bloco Concorrência; `null` sem marca e modelo reconhecidos. */
  market: LotMarketReference | null;
  /** Época das vendas do bloco Concorrência (análise fixada). */
  marketNote?: string;
};

/**
 * Resumo da análise (DESIGN.md §15.4): lance máximo como o número que decide, a composição do valor de venda e a
 * simulação de lance. A simulação é exploratória: não altera o lance atual do lote nem é gravada (SPEC RF-04).
 * Renderizar fora do <form> da análise, para o lance simulado nunca ser enviado.
 */
export function AnalysisSummary({ model, currentBid, market, marketNote }: AnalysisSummaryProps) {
  const { outcome, complete } = model;
  const [bidText, setBidText] = useState(currentBid === null ? "" : formatMoneyInput(currentBid));
  const parsedBid = bidText.trim() === "" ? null : parseBRL(bidText);
  const bid = parsedBid !== null && parsedBid >= 0 ? parsedBid : null;
  const simulation = complete && bid !== null ? simulateBid(complete, bid) : null;
  const comparison = compareToLimit(outcome, bid);
  const breakEvenBid = complete ? calculateBreakEvenBid(complete) : null;

  const STEP_CENTS = 50_000;
  function setBidValue(next: Cents) {
    setBidText(formatMoneyInput(next));
  }
  function stepBid(delta: number) {
    const base = bid ?? 0;
    const next = Math.min(MAX_CENTS, Math.max(0, base + delta));
    setBidValue(cents(next));
  }

  const quickScenarios: { label: string; value: Cents }[] = [];
  if (currentBid !== null && currentBid > 0) quickScenarios.push({ label: "Lance atual", value: currentBid });
  if (market?.band) {
    quickScenarios.push({ label: "Mediana", value: market.band.median });
    quickScenarios.push({ label: "P75", value: market.band.high });
  }
  if (breakEvenBid !== null && breakEvenBid > 0) {
    quickScenarios.push({ label: "Margem zero", value: breakEvenBid });
  }

  return (
    <Card variant="summary" className="grid gap-5.5 p-5 md:p-7 lg:sticky lg:top-6">
      <section aria-label="Lance máximo" className="grid gap-1.5">
        <p className="text-caption text-muted">Lance máximo</p>
        {outcome.kind === "viable" ? (
          <p className="text-display text-foreground tabular-nums">{formatBRL(outcome.maxBid)}</p>
        ) : outcome.kind === "not_viable" ? (
          <p className="text-heading-2 text-foreground">Sem lance viável com estas premissas</p>
        ) : (
          <div className="grid gap-1">
            <p className="text-heading-2 text-muted">Faltam dados para calcular</p>
            <p className="text-caption text-muted">
              Pendente: {outcome.missing.map((field) => FIELD_LABELS[field]).join(", ")}.
            </p>
          </div>
        )}
        <p className="text-caption text-muted">Maior lance que preserva a margem desejada.</p>
      </section>

      {complete && outcome.kind === "viable" ? (
        <Composition
          parts={[
            { label: "Custos fixos", value: complete.fixedCosts, tone: "bg-muted" },
            { label: "Comissão no limite", value: outcome.commissionAtMaxBid, tone: "bg-muted-subtle" },
            { label: "Reserva para imprevistos", value: complete.riskReserve, tone: "bg-control-border" },
            { label: "Margem estimada no limite", value: outcome.marginAtMaxBid, tone: "bg-success" },
          ]}
          marketValue={complete.marketValue}
          maxBid={outcome.maxBid}
        />
      ) : complete ? (
        <dl className="grid gap-0.5 text-label font-normal">
          <Row label="Valor de venda esperado">
            <Money value={complete.marketValue} />
          </Row>
          <Row label="Custos fixos">
            <Money value={complete.fixedCosts} />
          </Row>
          <Row label="Reserva para imprevistos">
            <Money value={complete.riskReserve} />
          </Row>
          <Row label="Margem desejada">
            <Money value={complete.desiredMargin} />
          </Row>
        </dl>
      ) : null}

      <section aria-label="Simulação de lance" className="grid gap-3 border-t border-border-strong pt-5">
        <CurrencyInput
          label="Lance simulado"
          helperText="Não altera o lance atual do lote."
          value={bidText}
          onChange={(event) => setBidText(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Atalhos de simulação">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={(bid ?? 0) === 0}
            onClick={() => stepBid(-STEP_CENTS)}
            aria-label="Diminuir R$ 500 no lance simulado"
          >
            − R$ 500
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => stepBid(STEP_CENTS)}
            aria-label="Aumentar R$ 500 no lance simulado"
          >
            + R$ 500
          </Button>
          {quickScenarios.map((scenario) => (
            <Button
              key={scenario.label}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBidValue(scenario.value)}
              className="border border-border text-caption"
            >
              {scenario.label}
            </Button>
          ))}
        </div>
        {breakEvenBid !== null ? (
          <p className="text-caption text-muted tabular-nums">
            Ponto de equilíbrio (margem R$ 0):{" "}
            <strong className="font-medium text-foreground">{formatBRL(breakEvenBid)}</strong>
          </p>
        ) : null}
        {simulation ? (
          <dl className="grid gap-0.5 text-label font-normal" aria-live="polite">
            <Row label="Comissão">
              <Money value={simulation.commission} />
            </Row>
            <Row label="Custo total estimado">
              <Money value={simulation.totalCost} />
            </Row>
            <Row label="Margem estimada" strong>
              <MarginValue value={simulation.estimatedMargin} />
            </Row>
          </dl>
        ) : null}
        {/* Com limite e lance, o texto colorido já diz a situação; sem eles, o rótulo da comparação. */}
        {simulation && outcome.kind === "viable" ? (
          <DifferenceText value={differenceToLimit(outcome.maxBid, simulation.bid)} />
        ) : (
          <Badge variant={LIMIT_COMPARISON_VARIANTS[comparison]} className="w-fit">
            {LIMIT_COMPARISON_LABELS[comparison]}
          </Badge>
        )}
      </section>

      {market === null ? null : (
        <CompetitionBlock
          market={market}
          maxBid={outcome.kind === "viable" ? outcome.maxBid : null}
          bid={bid}
          note={marketNote}
        />
      )}
    </Card>
  );
}

type Part = { label: string; value: Cents; tone: string };

/** Valor de venda decomposto até o lance máximo: a barra é decorativa, a lista ao lado diz o mesmo em texto. */
function Composition({ parts, marketValue, maxBid }: { parts: Part[]; marketValue: Cents; maxBid: Cents }) {
  const width = (value: number) => `${marketValue > 0 ? (Math.max(value, 0) / marketValue) * 100 : 0}%`;
  return (
    <div className="grid gap-2.5">
      <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        <div className="bg-foreground" style={{ width: width(maxBid) }} />
        {parts.map((part) => (
          <div key={part.label} className={part.tone} style={{ width: width(part.value) }} />
        ))}
      </div>
      <dl className="grid text-label font-normal">
        <Row label="Valor de venda esperado">
          <Money value={marketValue} />
        </Row>
        {parts.map((part) => (
          <Row key={part.label} label={part.label} swatch={part.tone}>
            − <Money value={part.value} />
          </Row>
        ))}
        <Row label="Lance máximo" swatch="bg-foreground" strong className="mt-1 border-t border-border-strong pt-2">
          <Money value={maxBid} />
        </Row>
      </dl>
    </div>
  );
}

type RowProps = { label: string; strong?: boolean; swatch?: string; className?: string; children: React.ReactNode };

function Row({ label, strong, swatch, className, children }: RowProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <dt
        className={cn("flex items-center gap-2 text-foreground-secondary", strong && "font-semibold text-foreground")}
      >
        {swatch ? <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-xs", swatch)} /> : null}
        {label}
      </dt>
      <dd className={cn("text-right whitespace-nowrap tabular-nums", strong && "font-semibold")}>{children}</dd>
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
  if (value === 0) return <span className="text-label">No limite</span>;
  const amount = formatBRL(cents(Math.abs(value)));
  return value > 0 ? (
    <span className="text-body font-semibold text-success tabular-nums">{amount} de folga</span>
  ) : (
    <span className="text-body font-semibold text-error tabular-nums">{amount} acima do limite</span>
  );
}
