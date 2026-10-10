"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription, Button, Input, SelectField, Textarea } from "@/components/ui";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";
import { toZonedDateTimeInput } from "@/lib/dates";

import { ORIGIN_OPTIONS, STATUS_OPTIONS } from "../labels";
import type { AuctionDetail } from "../types";

type AuctionFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  auction?: AuctionDetail;
  cancelHref: Route;
  submitLabel: string;
};

export function AuctionForm({ action, auction, cancelHref, submitLabel }: AuctionFormProps) {
  const [state, formAction, pending] = useActionState(action, idleState);
  // Após erro, o valor digitado prevalece sobre o salvo.
  const value = (field: string, saved?: string | null) => fieldValue(state, field) ?? saved ?? undefined;
  // Cadastro novo parte de "Não informada": a origem raramente muda a análise.
  const origin = value("origin", auction?.origin ?? "unknown");
  const hasExtras = Boolean(
    auction?.city || auction?.state || auction?.noticeUrl || auction?.platformUrl || auction?.notes,
  );
  const extrasError = ["city", "state", "noticeUrl", "platformUrl", "notes"].some(
    (field) => fieldError(state, field) !== undefined,
  );
  const status = value("status", auction?.status ?? "scheduled");

  return (
    <form action={formAction} className="grid gap-8" noValidate>
      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Evento</legend>
        <Input
          name="name"
          label="Nome do leilão"
          placeholder="Ex.: Leilão Detran SP — outubro"
          required
          maxLength={200}
          containerClassName="md:col-span-2"
          defaultValue={value("name", auction?.name)}
          error={fieldError(state, "name")}
        />
        <Input
          name="auctioneer"
          label="Organizador"
          placeholder="Leiloeiro ou plataforma"
          required
          maxLength={200}
          defaultValue={value("auctioneer", auction?.auctioneer)}
          error={fieldError(state, "auctioneer")}
        />
        <Input
          name="startsAt"
          type="datetime-local"
          label="Data e hora"
          helperText="Horário de Brasília."
          required
          defaultValue={value("startsAt", auction ? toZonedDateTimeInput(auction.startsAt) : undefined)}
          error={fieldError(state, "startsAt")}
        />
        {/* key remonta o Select quando o valor restaurado muda (o reset do formulário não o alcança). */}
        <SelectField
          key={`origin-${origin ?? ""}`}
          name="origin"
          label="Origem"
          required
          options={ORIGIN_OPTIONS}
          defaultValue={origin}
          helperText="Classificação manual; não implica validação jurídica."
          error={fieldError(state, "origin")}
        />
        <SelectField
          key={`status-${status}`}
          name="status"
          label="Status"
          required
          options={STATUS_OPTIONS}
          defaultValue={status}
          error={fieldError(state, "status")}
        />
      </fieldset>

      <details className="group" open={hasExtras || extrasError}>
        <summary className="cursor-pointer text-label text-foreground-secondary hover:text-foreground">
          Local, links e observações
        </summary>
        <fieldset className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
          <legend className="sr-only">Local e referências</legend>
          <Input
            name="city"
            label="Cidade"
            maxLength={120}
            defaultValue={value("city", auction?.city)}
            error={fieldError(state, "city")}
          />
          <Input
            name="state"
            label="UF"
            placeholder="SP"
            maxLength={2}
            autoCapitalize="characters"
            className="uppercase"
            defaultValue={value("state", auction?.state)}
            error={fieldError(state, "state")}
          />
          <Input
            name="noticeUrl"
            type="url"
            label="URL do edital"
            placeholder="https://"
            containerClassName="md:col-span-2"
            defaultValue={value("noticeUrl", auction?.noticeUrl)}
            error={fieldError(state, "noticeUrl")}
          />
          <Input
            name="platformUrl"
            type="url"
            label="URL da plataforma"
            placeholder="https://"
            containerClassName="md:col-span-2"
            defaultValue={value("platformUrl", auction?.platformUrl)}
            error={fieldError(state, "platformUrl")}
          />
          <Textarea
            name="notes"
            label="Observações"
            rows={4}
            maxLength={5_000}
            containerClassName="md:col-span-2"
            defaultValue={value("notes", auction?.notes)}
            error={fieldError(state, "notes")}
          />
        </fieldset>
      </details>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 md:flex-row md:justify-end">
        <Button asChild variant="secondary">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" loading={pending} loadingLabel="Salvando…">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
