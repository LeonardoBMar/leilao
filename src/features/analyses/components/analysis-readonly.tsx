import { DataList, DataRow, Money, Section, SectionTitle } from "@/components/ui";
import { completeInputs } from "@/domain/finance/calculator";
import { formatBps, formatCalendarDate, formatMonth } from "@/lib/format";

import { FIXED_COST_LABELS } from "../labels";
import { fixedSummary } from "../summary-model";
import type { AnalysisDetail } from "../types";
import { AnalysisSummary } from "./analysis-summary";

/** Versão fixada em modo leitura (RF-05, DESIGN.md §15.4): premissas em linhas à esquerda, resumo ao lado. */
export function AnalysisReadonly({ analysis }: { analysis: AnalysisDetail }) {
  const { inputs, references, outputs } = analysis;
  const complete = completeInputs(inputs);

  return (
    <div className="grid items-start gap-9 xl:grid-cols-[minmax(0,1fr)_28.75rem] xl:gap-14">
      <div className="grid content-start gap-8">
        <Section className="gap-2.5">
          <SectionTitle>Referências de preço</SectionTitle>
          <DataList>
            <DataRow label="Valor de venda esperado">
              <Money value={inputs.marketValue} className="font-semibold" />
            </DataRow>
            <DataRow label="Referência">
              <Joined
                parts={[
                  references.marketReferenceDate ? formatCalendarDate(references.marketReferenceDate) : null,
                  references.marketReferenceSource,
                ]}
              />
            </DataRow>
            <DataRow label="FIPE">
              <Money value={references.fipeValue} />
            </DataRow>
            <DataRow label="Referência FIPE">
              <Joined
                parts={[
                  references.fipeReferenceMonth ? formatMonth(references.fipeReferenceMonth) : null,
                  references.fipeReferenceSource,
                ]}
              />
            </DataRow>
          </DataList>
        </Section>

        <Section className="gap-2.5">
          <SectionTitle>Custos fora do lance</SectionTitle>
          <DataList>
            {FIXED_COST_LABELS.map(([field, label]) => (
              <DataRow key={field} label={label}>
                <Money value={inputs[field]} />
              </DataRow>
            ))}
            <DataRow label="Custos fixos" emphasis>
              <Money value={complete.ok ? complete.value.fixedCosts : null} />
            </DataRow>
          </DataList>
        </Section>

        <Section className="gap-2.5">
          <SectionTitle>Comissão e estratégia</SectionTitle>
          <DataList>
            <DataRow
              label={
                <>
                  Comissão{" "}
                  <span className="text-caption text-muted">
                    {inputs.commissionMode === "fixed" ? "valor fixo" : "sobre o lance"}
                  </span>
                </>
              }
            >
              {inputs.commissionMode === "fixed" ? (
                <Money value={inputs.commissionFixed} />
              ) : inputs.commissionMode === "percentage" && inputs.commissionRateBps !== null ? (
                formatBps(inputs.commissionRateBps)
              ) : (
                <Muted />
              )}
            </DataRow>
            <DataRow label={<WithRate label="Reserva para imprevistos" rate={inputs.riskReserveRateBps} />}>
              <Money value={inputs.riskReserve} />
            </DataRow>
            <DataRow label={<WithRate label="Margem desejada" rate={inputs.desiredMarginRateBps} />}>
              <Money value={inputs.desiredMargin} />
            </DataRow>
          </DataList>
        </Section>

        {references.notes ? (
          <Section className="gap-2.5">
            <SectionTitle>Notas</SectionTitle>
            <p className="text-body whitespace-pre-line text-foreground-secondary">{references.notes}</p>
          </Section>
        ) : null}
      </div>

      {outputs ? <AnalysisSummary model={fixedSummary(inputs, outputs)} currentBid={analysis.lot.currentBid} /> : null}
    </div>
  );
}

function WithRate({ label, rate }: { label: string; rate: number | null }) {
  return (
    <>
      {label}
      {rate === null ? null : <span className="text-caption text-muted"> {formatBps(rate)} do valor de venda</span>}
    </>
  );
}

function Joined({ parts }: { parts: (string | null)[] }) {
  const text = parts.filter(Boolean).join(" · ");
  return text ? <span className="text-foreground-secondary">{text}</span> : <Muted />;
}

function Muted() {
  return <span className="text-muted-subtle">—</span>;
}
