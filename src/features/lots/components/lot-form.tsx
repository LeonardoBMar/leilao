"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription, Button, Checkbox, CurrencyInput, Input, Textarea } from "@/components/ui";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";

import type { LotDetail } from "../types";

type LotFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  lot?: LotDetail;
  cancelHref: Route;
  submitLabel: string;
};

/** Centavos → texto no formato do CurrencyInput ("1234,56"), sem separador de milhar para facilitar a edição. */
function centsToInput(value: number | null | undefined): string | undefined {
  return value == null ? undefined : (value / 100).toFixed(2).replace(".", ",");
}

export function LotForm({ action, lot, cancelHref, submitLabel }: LotFormProps) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const value = (field: string, saved?: string | number | null) =>
    fieldValue(state, field) ?? (saved == null ? undefined : String(saved));
  const isFollowed =
    state.status === "error" ? fieldValue(state, "isFollowed") !== undefined : (lot?.isFollowed ?? true);
  const isEdit = lot !== undefined;
  const extrasError = ["lotUrl", "startingBid", "notes"].some((field) => fieldError(state, field) !== undefined);
  const hasExtras = Boolean(lot?.lotUrl || lot?.startingBid || lot?.notes);

  return (
    <form action={formAction} className="grid gap-8" noValidate>
      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Identificação</legend>
        <Input
          name="lotNumber"
          label="Número do lote"
          placeholder="Ex.: 0152 ou 152-A"
          required
          maxLength={30}
          helperText="Único dentro do leilão."
          defaultValue={value("lotNumber", lot?.lotNumber)}
          error={fieldError(state, "lotNumber")}
        />
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Veículo</legend>
        <Input
          name="brand"
          label="Marca"
          required
          maxLength={80}
          defaultValue={value("brand", lot?.brand)}
          error={fieldError(state, "brand")}
        />
        <Input
          name="model"
          label="Modelo"
          required
          maxLength={80}
          defaultValue={value("model", lot?.model)}
          error={fieldError(state, "model")}
        />
        <Input
          name="vehicleVersion"
          label="Versão"
          maxLength={120}
          containerClassName="md:col-span-2"
          defaultValue={value("vehicleVersion", lot?.vehicleVersion)}
          error={fieldError(state, "vehicleVersion")}
        />
        <Input
          name="modelYear"
          label="Ano-modelo"
          inputMode="numeric"
          required
          maxLength={4}
          defaultValue={value("modelYear", lot?.modelYear)}
          error={fieldError(state, "modelYear")}
        />
        <Input
          name="manufactureYear"
          label="Ano de fabricação"
          inputMode="numeric"
          maxLength={4}
          defaultValue={value("manufactureYear", lot?.manufactureYear)}
          error={fieldError(state, "manufactureYear")}
        />
        <Input
          name="mileageKm"
          label="Quilometragem (km)"
          inputMode="numeric"
          helperText="Deixe vazio se desconhecida; 0 significa zero informado."
          defaultValue={value("mileageKm", lot?.mileageKm)}
          error={fieldError(state, "mileageKm")}
        />
      </fieldset>

      {/* Na edição, lance atual e acompanhamento se mudam na própria ficha (a mutation os ignora). */}
      {isEdit ? null : (
        <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
          <legend className="mb-4 text-heading-3 text-foreground">Lance e acompanhamento</legend>
          <CurrencyInput
            name="currentBid"
            label="Lance atual"
            helperText="Última observação manual; não atualiza sozinho."
            defaultValue={value("currentBid")}
            error={fieldError(state, "currentBid")}
          />
          <Checkbox
            key={`followed-${isFollowed}`}
            name="isFollowed"
            label="Acompanhar este lote"
            description="Aparece no dashboard enquanto não houver resultado."
            defaultChecked={isFollowed}
            containerClassName="md:mt-7"
          />
        </fieldset>
      )}

      <details className="group" open={hasExtras || extrasError}>
        <summary className="cursor-pointer text-label text-foreground-secondary hover:text-foreground">
          Link, lance inicial e observações
        </summary>
        <fieldset className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
          <legend className="sr-only">Mais dados do lote</legend>
          <Input
            name="lotUrl"
            type="url"
            label="URL do lote"
            placeholder="https://"
            defaultValue={value("lotUrl", lot?.lotUrl)}
            error={fieldError(state, "lotUrl")}
          />
          <CurrencyInput
            name="startingBid"
            label="Lance inicial"
            defaultValue={value("startingBid", centsToInput(lot?.startingBid))}
            error={fieldError(state, "startingBid")}
          />
          <Textarea
            name="notes"
            label="Observações"
            rows={4}
            maxLength={5_000}
            containerClassName="md:col-span-2"
            defaultValue={value("notes", lot?.notes)}
            error={fieldError(state, "notes")}
          />
        </fieldset>
      </details>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 md:flex-row md:justify-end">
        <Button asChild variant="secondary">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" variant={isEdit ? "primary" : "secondary"} loading={pending} loadingLabel="Salvando…">
          {submitLabel}
        </Button>
        {isEdit ? null : (
          <Button type="submit" name="intent" value="analyze" loading={pending} loadingLabel="Salvando…">
            Cadastrar e analisar
          </Button>
        )}
      </div>
    </form>
  );
}
