"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert, AlertDescription, Button, FieldError, Input } from "@/components/ui";
import { DEFAULT_CRITERIA, type ListingCriteria } from "@/domain/listings/criteria";
import type { Cents } from "@/domain/money";
import {
  CategoryField,
  ConditionFields,
  DistanceField,
  FuelField,
  KeyField,
  MileageField,
  OriginField,
  PriceFields,
  SourceField,
  YearFields,
} from "@/features/listings/components/filters/criteria-controls";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";
import { formatMoneyInput } from "@/lib/format";

import type { WatchItem } from "../types";

type WatchFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  watch?: WatchItem;
  /** Critérios iniciais de um monitor novo (ex.: "Salvar como monitor" a partir dos filtros de Leilões). */
  initialCriteria?: ListingCriteria;
  sources: readonly { id: string; name: string }[];
  regionLabel: string;
  currentYear: number;
  submitLabel: string;
};

const reaisField = (value: Cents | null) => (value === null ? "" : formatMoneyInput(value));
const csv = (items: readonly string[] | null) => (items ?? []).join(",");

/**
 * Formulário do monitor (critérios de docs/PLANO-FILTROS.md): os mesmos controles da barra de filtros de Leilões,
 * guardados no estado e enviados em campos escondidos. Busca e nome são campos comuns.
 */
export function WatchForm({
  action,
  watch,
  initialCriteria,
  sources,
  regionLabel,
  currentYear,
  submitLabel,
}: WatchFormProps) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [criteria, setCriteria] = useState<ListingCriteria>(watch?.criteria ?? initialCriteria ?? DEFAULT_CRITERIA);
  const control = { criteria, onChange: (patch: Partial<ListingCriteria>) => setCriteria({ ...criteria, ...patch }) };
  // Após erro, o texto digitado prevalece sobre o salvo.
  const text = (field: string, saved?: string | null) => fieldValue(state, field) ?? saved ?? undefined;
  const yearError = fieldError(state, "yearFrom") ?? fieldError(state, "yearTo");
  const priceError = fieldError(state, "minPrice") ?? fieldError(state, "maxPrice");

  return (
    <form action={formAction} className="grid gap-10" noValidate>
      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <input type="hidden" name="yearFrom" value={criteria.yearFrom ?? ""} />
      <input type="hidden" name="yearTo" value={criteria.yearTo ?? ""} />
      <input type="hidden" name="minPrice" value={reaisField(criteria.minPrice)} />
      <input type="hidden" name="maxPrice" value={reaisField(criteria.maxPrice)} />
      <input type="hidden" name="maxMarketPct" value={criteria.maxMarketPct ?? ""} />
      <input type="hidden" name="maxMileageKm" value={criteria.maxMileageKm ?? ""} />
      <input type="hidden" name="distance" value={criteria.radiusKm ?? "todas"} />
      <input type="hidden" name="categories" value={csv(criteria.categories)} />
      <input type="hidden" name="condition" value={criteria.condition} />
      <input type="hidden" name="hide" value={csv(criteria.hide)} />
      <input type="hidden" name="sources" value={csv(criteria.sources)} />
      <input type="hidden" name="origins" value={csv(criteria.origins)} />
      <input type="hidden" name="fuels" value={csv(criteria.fuels)} />
      {criteria.keyOnly ? <input type="hidden" name="keyOnly" value="1" /> : null}

      <FormSection title="Veículo">
        <Input
          name="search"
          label="Marca, modelo ou versão"
          placeholder="Ex.: VW Fox"
          helperText="Todas as palavras precisam aparecer, em qualquer ordem."
          maxLength={100}
          defaultValue={text("search", watch?.criteria.search ?? initialCriteria?.search)}
          error={fieldError(state, "search")}
        />
        <div className="grid gap-2">
          <YearFields {...control} currentYear={currentYear} />
          {yearError ? <FieldError>{yearError}</FieldError> : null}
        </div>
        <CategoryField {...control} />
        <FuelField {...control} />
        <MileageField {...control} />
        <KeyField {...control} />
      </FormSection>

      <FormSection title="Preço">
        <div className="grid gap-2">
          <PriceFields {...control} />
          {priceError ? <FieldError>{priceError}</FieldError> : null}
        </div>
      </FormSection>

      <FormSection title="Condição">
        <ConditionFields {...control} />
      </FormSection>

      <FormSection title="Onde e de quem">
        <DistanceField {...control} regionLabel={regionLabel} />
        <SourceField {...control} sources={sources} />
        <OriginField {...control} />
      </FormSection>

      <FormSection title="Nome">
        <Input
          name="name"
          label="Nome do monitor"
          placeholder="Opcional. Ex.: Fox para revenda"
          helperText="Sem nome, o monitor aparece pela busca."
          maxLength={80}
          defaultValue={text("name", watch?.name)}
          error={fieldError(state, "name")}
        />
      </FormSection>

      <p className="text-caption text-muted">
        Só lotes que aparecerem daqui em diante geram alerta. Os que já estão abertos aparecem na lista de monitores
        como &quot;combinam agora&quot;.
      </p>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 md:flex-row md:justify-end">
        <Button asChild variant="secondary">
          <Link href="/monitores">Cancelar</Link>
        </Button>
        <Button type="submit" loading={pending} loadingLabel="Salvando…">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid max-w-2xl gap-6">
      <h2 className="text-heading-3 text-foreground">{title}</h2>
      {children}
    </section>
  );
}
