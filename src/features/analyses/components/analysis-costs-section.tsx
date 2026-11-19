"use client";

import { Button, Checkbox, CurrencyInput, Input, RadioGroup, RadioItem, Textarea } from "@/components/ui";
import type { AnalysisInputs, CommissionMode } from "@/domain/finance/calculator";
import type { Cents } from "@/domain/money";
import { type ActionState, fieldError, fieldValue } from "@/lib/action-state";
import { formatMoneyInput } from "@/lib/format";

import { FIXED_COST_LABELS } from "../labels";
import type { AnalysisReferences } from "../schemas";

const centsToInput = (value: Cents | null) => (value === null ? undefined : formatMoneyInput(value));
const bpsToInput = (value: number | null) =>
  value === null
    ? undefined
    : (value / 100)
        .toFixed(2)
        .replace(/\.?0+$/, "")
        .replace(".", ",");

type MoneyField = (typeof FIXED_COST_LABELS)[number][0] | "riskReserve" | "desiredMargin";

type AnalysisCostsSectionProps = {
  state: ActionState;
  saved: AnalysisInputs;
  references: AnalysisReferences;
  mode: CommissionMode | "";
  prefill: Record<string, string> | null;
  emptyFixedCostCount: number;
  value: (field: string, stored?: string) => string | undefined;
  onZeroEmptyFixedCosts: () => void;
  onModeChange: (next: string) => void;
};

/** Blocos de custos fixos, comissão do leiloeiro, estratégia e notas do rascunho. */
export function AnalysisCostsSection({
  state,
  saved,
  references,
  mode,
  prefill,
  emptyFixedCostCount,
  value,
  onZeroEmptyFixedCosts,
  onModeChange,
}: AnalysisCostsSectionProps) {
  const money = (name: MoneyField, label: string, helperText?: string) => (
    <CurrencyInput
      name={name}
      label={label}
      helperText={helperText}
      defaultValue={value(name, centsToInput(saved[name]))}
      error={fieldError(state, name)}
    />
  );

  const percent = (name: "riskReserveRate" | "desiredMarginRate", label: string, helperText: string) => (
    <Input
      name={name}
      label={label}
      inputMode="decimal"
      placeholder={name === "riskReserveRate" ? "5" : "15"}
      helperText={helperText}
      defaultValue={value(
        name,
        bpsToInput(name === "riskReserveRate" ? saved.riskReserveRateBps : saved.desiredMarginRateBps),
      )}
      error={fieldError(state, name)}
    />
  );

  return (
    <>
      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Custos fixos</legend>
        <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 md:col-span-2">
          <p className="text-caption text-muted">
            Informe 0 quando não houver o custo. Campo vazio significa “não informado” e impede a fixação.
          </p>
          {emptyFixedCostCount > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={onZeroEmptyFixedCosts}>
              Preencher vazios com R$ 0 ({emptyFixedCostCount})
            </Button>
          ) : null}
        </div>
        {FIXED_COST_LABELS.map(([name, label]) => (
          <div key={name}>{money(name, label)}</div>
        ))}
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Comissão do leiloeiro</legend>
        <div className="grid gap-2 md:col-span-2">
          <RadioGroup
            name="commissionMode"
            value={mode}
            onValueChange={onModeChange}
            aria-label="Modalidade da comissão"
            className="md:grid-cols-2"
          >
            <RadioItem value="fixed" label="Valor fixo" description="Mesmo valor para qualquer lance." />
            <RadioItem value="percentage" label="Percentual sobre o lance" description="Ex.: 5% do lance." />
          </RadioGroup>
          {fieldError(state, "commissionMode") ? (
            <p className="text-caption text-error" role="alert">
              {fieldError(state, "commissionMode")}
            </p>
          ) : null}
        </div>
        {mode === "fixed" ? (
          <CurrencyInput
            name="commissionFixed"
            label="Comissão fixa"
            defaultValue={value("commissionFixed", centsToInput(saved.commissionFixed))}
            error={fieldError(state, "commissionFixed")}
          />
        ) : null}
        {mode === "percentage" ? (
          <Input
            name="commissionRate"
            label="Taxa de comissão (%)"
            inputMode="decimal"
            placeholder="5,00"
            helperText="Aplicada sobre o lance, arredondada ao centavo."
            defaultValue={value("commissionRate", bpsToInput(saved.commissionRateBps))}
            error={fieldError(state, "commissionRate")}
          />
        ) : null}
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Estratégia</legend>
        {percent("riskReserveRate", "Reserva para imprevistos (%)", "Do valor de venda.")}
        {percent("desiredMarginRate", "Margem desejada (%)", "Do valor de venda: lucro pretendido ou economia mínima.")}
        {/* Análises anteriores ao % (D-38) guardavam R$; o campo aparece até o % ser preenchido. */}
        {saved.riskReserve !== null && saved.riskReserveRateBps === null
          ? money("riskReserve", "Reserva em R$ (versão anterior)", "Vale enquanto o % estiver vazio.")
          : null}
        {saved.desiredMargin !== null && saved.desiredMarginRateBps === null
          ? money("desiredMargin", "Margem em R$ (versão anterior)", "Vale enquanto o % estiver vazio.")
          : null}
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-4 text-heading-3 text-foreground">Notas</legend>
        <Textarea
          name="notes"
          label="Premissas, danos, documentação e dúvidas"
          rows={5}
          maxLength={10_000}
          defaultValue={value("notes", references.notes ?? undefined)}
          error={fieldError(state, "notes")}
        />
        <Checkbox
          name="knownResultAtCreation"
          label="Fiz esta análise já conhecendo o resultado do lote"
          description="Análises retrospectivas ficam fora do indicador de decisões anteriores ao resultado."
          defaultChecked={
            state.status === "error"
              ? fieldValue(state, "knownResultAtCreation") !== undefined
              : prefill
                ? prefill.knownResultAtCreation !== undefined
                : references.knownResultAtCreation
          }
        />
      </fieldset>
    </>
  );
}
