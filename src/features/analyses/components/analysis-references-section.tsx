"use client";

import { Calculator, FileInput } from "lucide-react";

import { Button, CurrencyInput, Input } from "@/components/ui";
import type { Cents } from "@/domain/money";
import { type ActionState, fieldError } from "@/lib/action-state";
import { toCalendarDateInput, toMonthInput } from "@/lib/dates";
import { formatBRL, formatMoneyInput } from "@/lib/format";

import type { ListingFipe } from "../fipe-fill";
import type { AnalysisReferences } from "../schemas";

const centsToInput = (value: Cents | null) => (value === null ? undefined : formatMoneyInput(value));

type AnalysisReferencesSectionProps = {
  state: ActionState;
  marketValue: Cents | null;
  references: AnalysisReferences;
  listingFipe: ListingFipe | null;
  value: (field: string, stored?: string) => string | undefined;
  onApplyListingFipe: () => void;
  onEstimateSaleAndRepairs: () => void;
};

/** Bloco de referências FIPE e valor de venda esperado do rascunho. */
export function AnalysisReferencesSection({
  state,
  marketValue,
  references,
  listingFipe,
  value,
  onApplyListingFipe,
  onEstimateSaleAndRepairs,
}: AnalysisReferencesSectionProps) {
  return (
    <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
      <legend className="mb-4 text-heading-3 text-foreground">Referências de preço</legend>
      <CurrencyInput
        name="fipeValue"
        label="FIPE (opcional)"
        helperText="Base das premissas padrão de valor de venda e reparos."
        defaultValue={value("fipeValue", centsToInput(references.fipeValue))}
        error={fieldError(state, "fipeValue")}
      />
      <div className="flex flex-wrap gap-2 md:mt-7">
        {listingFipe === null ? null : (
          <Button type="button" variant="secondary" onClick={onApplyListingFipe}>
            <FileInput aria-hidden="true" />
            Usar FIPE do anúncio ({formatBRL(listingFipe.value)})
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onEstimateSaleAndRepairs}>
          <Calculator aria-hidden="true" />
          Estimar a partir da FIPE
        </Button>
      </div>
      <CurrencyInput
        name="marketValue"
        label="Valor de venda esperado"
        helperText="Quanto o veículo vale após os reparos. Padrão: FIPE menos o desconto pela condição."
        containerClassName="md:col-span-2"
        defaultValue={value("marketValue", centsToInput(marketValue))}
        error={fieldError(state, "marketValue")}
      />
      {/* Metadados raros: recolhidos, mas sempre enviados com o formulário. */}
      <details
        className="group md:col-span-2"
        open={["marketReferenceDate", "marketReferenceSource", "fipeReferenceMonth", "fipeReferenceSource"].some(
          (field) => fieldError(state, field) !== undefined,
        )}
      >
        <summary className="cursor-pointer text-label text-foreground-secondary hover:text-foreground">
          Fontes e datas das referências
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
          <Input
            name="marketReferenceDate"
            type="date"
            label="Data da referência"
            defaultValue={value(
              "marketReferenceDate",
              references.marketReferenceDate ? toCalendarDateInput(references.marketReferenceDate) : undefined,
            )}
            error={fieldError(state, "marketReferenceDate")}
          />
          <Input
            name="marketReferenceSource"
            label="Fonte da referência"
            placeholder="Ex.: anúncios similares, avaliação"
            maxLength={200}
            defaultValue={value("marketReferenceSource", references.marketReferenceSource ?? undefined)}
            error={fieldError(state, "marketReferenceSource")}
          />
          <Input
            name="fipeReferenceMonth"
            type="month"
            label="Mês da FIPE"
            defaultValue={value(
              "fipeReferenceMonth",
              references.fipeReferenceMonth ? toMonthInput(references.fipeReferenceMonth) : undefined,
            )}
            error={fieldError(state, "fipeReferenceMonth")}
          />
          <Input
            name="fipeReferenceSource"
            label="Fonte da FIPE"
            maxLength={200}
            defaultValue={value("fipeReferenceSource", references.fipeReferenceSource ?? undefined)}
            error={fieldError(state, "fipeReferenceSource")}
          />
        </div>
      </details>
    </fieldset>
  );
}
