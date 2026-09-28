"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription, Button, CurrencyInput, Input, SelectField } from "@/components/ui";
import {
  CATEGORY_KEYS,
  CONDITION_KEYS,
  DEFAULT_CATEGORY,
  DEFAULT_CONDITION,
  DEFAULT_RADIUS_KM,
} from "@/domain/listings/criteria";
import { CATEGORY_LABELS, CONDITION_LABELS, DISTANCE_OPTIONS } from "@/features/listings/schemas";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";

import type { WatchItem } from "../types";

type WatchFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  watch?: WatchItem;
  regionLabel: string;
  submitLabel: string;
};

function centsToInput(value: number | null | undefined): string | undefined {
  return value == null ? undefined : (value / 100).toFixed(2).replace(".", ",");
}

export function WatchForm({ action, watch, regionLabel, submitLabel }: WatchFormProps) {
  const [state, formAction, pending] = useActionState(action, idleState);
  // Após erro, o valor digitado prevalece sobre o salvo.
  const value = (field: string, saved?: string | number | null) =>
    fieldValue(state, field) ?? (saved == null ? undefined : String(saved));
  const criteria = watch?.criteria;
  const distance = value(
    "distance",
    criteria ? (criteria.radiusKm === null ? "todas" : criteria.radiusKm) : DEFAULT_RADIUS_KM,
  );
  const category = value("category", criteria?.category ?? DEFAULT_CATEGORY);
  const condition = value("condition", criteria?.condition ?? DEFAULT_CONDITION);

  return (
    <form action={formAction} className="grid gap-8" noValidate>
      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Veículo</legend>
        <Input
          name="search"
          label="Marca, modelo ou versão"
          placeholder="Ex.: VW Fox"
          helperText="Todas as palavras precisam aparecer, em qualquer ordem."
          maxLength={100}
          containerClassName="md:col-span-2"
          defaultValue={value("search", criteria?.search)}
          error={fieldError(state, "search")}
        />
        <Input
          name="yearFrom"
          type="number"
          inputMode="numeric"
          label="Ano de"
          min={1900}
          max={2100}
          defaultValue={value("yearFrom", criteria?.yearFrom)}
          error={fieldError(state, "yearFrom")}
        />
        <Input
          name="yearTo"
          type="number"
          inputMode="numeric"
          label="Ano até"
          min={1900}
          max={2100}
          defaultValue={value("yearTo", criteria?.yearTo)}
          error={fieldError(state, "yearTo")}
        />
        <CurrencyInput
          name="maxPrice"
          label="Lance até"
          helperText="Lance atual ou, sem lance, o inicial."
          defaultValue={value("maxPrice", centsToInput(criteria?.maxPrice))}
          error={fieldError(state, "maxPrice")}
        />
        {/* key remonta o Select quando o valor restaurado muda (o reset do formulário não o alcança). */}
        <SelectField
          key={`condition-${condition ?? ""}`}
          name="condition"
          label="Condição"
          helperText="Como o leiloeiro declara (monta, sucata)."
          options={CONDITION_KEYS.map((key) => ({ value: key, label: CONDITION_LABELS[key] }))}
          defaultValue={condition}
          error={fieldError(state, "condition")}
        />
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Onde e o quê</legend>
        <SelectField
          key={`distance-${distance ?? ""}`}
          name="distance"
          label={`Distância de ${regionLabel}`}
          options={[
            ...DISTANCE_OPTIONS.map((km) => ({ value: km, label: `Até ${km} km` })),
            { value: "todas", label: "Qualquer distância" },
          ]}
          defaultValue={distance}
          error={fieldError(state, "distance")}
        />
        <SelectField
          key={`category-${category ?? ""}`}
          name="category"
          label="Categoria"
          options={CATEGORY_KEYS.map((key) => ({ value: key, label: CATEGORY_LABELS[key] }))}
          defaultValue={category}
          error={fieldError(state, "category")}
        />
        <Input
          name="name"
          label="Nome do monitor"
          placeholder="Opcional. Ex.: Fox para revenda"
          helperText="Sem nome, o monitor aparece pela busca."
          maxLength={80}
          containerClassName="md:col-span-2"
          defaultValue={value("name", watch?.name)}
          error={fieldError(state, "name")}
        />
      </fieldset>

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
