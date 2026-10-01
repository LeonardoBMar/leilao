import { Card, CardContent, CardHeader, CardTitle, Money } from "@/components/ui";
import { formatBps, formatCalendarDate, formatMonth } from "@/lib/format";

import { FIXED_COST_LABELS } from "../labels";
import { fixedSummary } from "../summary-model";
import type { AnalysisDetail } from "../types";
import { AnalysisSummary } from "./analysis-summary";

/** Versão fixada em modo leitura (RF-05, DESIGN.md §15.4). */
export function AnalysisReadonly({ analysis }: { analysis: AnalysisDetail }) {
  const { inputs, references, outputs } = analysis;

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="grid content-start gap-6 xl:col-span-7">
        <Card>
          <CardHeader>
            <CardTitle>Referências de preço</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item label="Valor de venda esperado">
                <Money value={inputs.marketValue} />
              </Item>
              <Item label="Referência">
                {[
                  references.marketReferenceDate ? formatCalendarDate(references.marketReferenceDate) : null,
                  references.marketReferenceSource,
                ]
                  .filter(Boolean)
                  .join(" · ") || <Muted />}
              </Item>
              <Item label="FIPE">
                <Money value={references.fipeValue} />
              </Item>
              <Item label="Referência FIPE">
                {[
                  references.fipeReferenceMonth ? formatMonth(references.fipeReferenceMonth) : null,
                  references.fipeReferenceSource,
                ]
                  .filter(Boolean)
                  .join(" · ") || <Muted />}
              </Item>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custos, comissão e estratégia</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {FIXED_COST_LABELS.map(([field, label]) => (
                <Item key={field} label={label}>
                  <Money value={inputs[field]} />
                </Item>
              ))}
              <Item label="Comissão">
                {inputs.commissionMode === "fixed" ? (
                  <>
                    <Money value={inputs.commissionFixed} /> (fixa)
                  </>
                ) : inputs.commissionMode === "percentage" && inputs.commissionRateBps !== null ? (
                  `${formatBps(inputs.commissionRateBps)} sobre o lance`
                ) : (
                  <Muted />
                )}
              </Item>
              <Item label="Reserva para imprevistos">
                <Money value={inputs.riskReserve} />
                {inputs.riskReserveRateBps === null
                  ? null
                  : ` (${formatBps(inputs.riskReserveRateBps)} do valor de venda)`}
              </Item>
              <Item label="Margem desejada">
                <Money value={inputs.desiredMargin} />
                {inputs.desiredMarginRateBps === null
                  ? null
                  : ` (${formatBps(inputs.desiredMarginRateBps)} do valor de venda)`}
              </Item>
            </dl>
          </CardContent>
        </Card>

        {references.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-body whitespace-pre-line text-foreground">{references.notes}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="xl:col-span-5">
        {outputs ? (
          <AnalysisSummary model={fixedSummary(inputs, outputs)} currentBid={analysis.lot.currentBid} />
        ) : null}
      </div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-body text-foreground">{children}</dd>
    </div>
  );
}

function Muted() {
  return <span className="text-muted">Não informado</span>;
}
