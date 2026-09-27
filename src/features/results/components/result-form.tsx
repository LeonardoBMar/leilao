"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  CurrencyInput,
  Input,
  RadioGroup,
  RadioItem,
  SelectField,
  Textarea,
} from "@/components/ui";
import { LOT_OUTCOMES, type LotOutcome, type PersonalOutcome } from "@/domain/results/results";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";
import { toZonedDateTimeInput } from "@/lib/dates";
import { formatBRL, formatDate } from "@/lib/format";

import { OUTCOME_LABELS, PERSONAL_OUTCOME_LABELS } from "../labels";
import type { LotResultContext } from "../types";

type ResultFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  context: LotResultContext;
};

const toOutcome = (value: string): LotOutcome | "" => LOT_OUTCOMES.find((item) => item === value) ?? "";
const centsToInput = (value: number | null) =>
  value === null ? undefined : (value / 100).toFixed(2).replace(".", ",");

/** Registro ou correção do resultado (SPEC RF-06; DESIGN.md §15.5). */
export function ResultForm({ action, context }: ResultFormProps) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const current = context.current;
  const isCorrection = current !== null;

  const [outcome, setOutcome] = useState<LotOutcome | "">(current?.outcome ?? "");
  const [personal, setPersonal] = useState<PersonalOutcome>(current?.personalOutcome ?? "observed");
  const [analysisId, setAnalysisId] = useState(current?.analysis?.id ?? context.suggestedAnalysisId ?? "none");
  const [eventAt, setEventAt] = useState(
    fieldValue(state, "eventAt") ?? (current?.eventAt ? toZonedDateTimeInput(current.eventAt) : ""),
  );

  const value = (field: string, stored?: string | null) => fieldValue(state, field) ?? stored ?? undefined;
  const isSold = outcome === "sold";

  return (
    <form action={formAction} className="grid gap-8" noValidate>
      <input type="hidden" name="baseRevision" value={current?.revision ?? 0} />

      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {isCorrection ? (
        <Alert variant="info">
          <AlertDescription>
            Você está corrigindo a revisão {current.revision}. Ela será preservada no histórico; a nova revisão passa a
            valer.
          </AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
        <legend className="mb-4 text-heading-3 text-foreground">Desfecho do lote</legend>
        <SelectField
          name="outcome"
          label="Desfecho"
          required
          value={outcome}
          onValueChange={(next) => {
            setOutcome(toOutcome(next));
            if (next !== "sold" && personal === "won") setPersonal("observed");
          }}
          options={LOT_OUTCOMES.map((item) => ({ value: item, label: OUTCOME_LABELS[item] }))}
          helperText="“Arrematado” descreve o lote, mesmo se outra pessoa comprou."
          error={fieldError(state, "outcome")}
        />
        {isSold ? (
          <CurrencyInput
            name="finalBid"
            label="Preço final"
            helperText="Deixe vazio se o preço for desconhecido; não haverá comparação."
            defaultValue={value("finalBid", centsToInput(current?.finalBid ?? null))}
            error={fieldError(state, "finalBid")}
          />
        ) : (
          <div aria-hidden="true" className="hidden md:block" />
        )}
        <Input
          name="eventAt"
          type="datetime-local"
          label="Data e hora do desfecho"
          helperText="Horário de Brasília, quando conhecido."
          value={eventAt}
          onChange={(event) => setEventAt(event.target.value)}
          error={fieldError(state, "eventAt")}
        />
        <Input
          name="sourceUrl"
          type="url"
          label="Fonte (URL)"
          placeholder="https://"
          defaultValue={value("sourceUrl", current?.sourceUrl)}
          error={fieldError(state, "sourceUrl")}
        />
        <Textarea
          name="sourceNotes"
          label="Fonte (descrição)"
          rows={2}
          maxLength={2_000}
          containerClassName="md:col-span-2"
          defaultValue={value("sourceNotes", current?.sourceNotes)}
          error={fieldError(state, "sourceNotes")}
        />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-4 text-heading-3 text-foreground">Análise usada na comparação</legend>
        <SelectField
          name="analysisId"
          label="Análise vinculada"
          value={analysisId}
          onValueChange={setAnalysisId}
          options={[
            { value: "none", label: "Nenhuma" },
            ...context.fixedAnalyses.map((analysis) => ({
              value: analysis.id,
              label: `v${analysis.version} · fixada em ${formatDate(analysis.fixedAt)} · ${
                analysis.isViable && analysis.maxBid !== null
                  ? `limite ${formatBRL(analysis.maxBid)}`
                  : "sem lance viável"
              }${analysis.knownResultAtCreation ? " · retrospectiva" : ""}`,
            })),
          ]}
          helperText={
            context.fixedAnalyses.length === 0
              ? "Este lote não tem análise fixada."
              : "Sugerimos a última análise fixada antes do resultado. O vínculo não muda sozinho depois."
          }
          error={fieldError(state, "analysisId")}
        />
        {analysisId !== "none" && eventAt === "" ? (
          <Checkbox
            name="priorDeclared"
            label="Confirmo que esta análise foi feita antes do desfecho"
            description="Sem o horário do desfecho, a confirmação é registrada como informação declarada. Sem ela, a temporalidade fica desconhecida e a análise sai do indicador."
            defaultChecked={
              state.status === "error" ? fieldValue(state, "priorDeclared") !== undefined : current?.priorDeclared
            }
          />
        ) : null}
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-4 text-heading-3 text-foreground">Minha participação</legend>
        <RadioGroup
          name="personalOutcome"
          value={personal}
          onValueChange={(next) => setPersonal(next === "won" || next === "bid_not_won" ? next : "observed")}
          aria-label="Minha participação"
          className="md:grid-cols-3"
        >
          <RadioItem value="observed" label={PERSONAL_OUTCOME_LABELS.observed} />
          <RadioItem value="bid_not_won" label={PERSONAL_OUTCOME_LABELS.bid_not_won} />
          <RadioItem
            value="won"
            label={PERSONAL_OUTCOME_LABELS.won}
            description={isSold ? undefined : "Exige desfecho arrematado."}
            disabled={!isSold}
          />
        </RadioGroup>
        {fieldError(state, "personalOutcome") ? (
          <p className="text-caption text-error" role="alert">
            {fieldError(state, "personalOutcome")}
          </p>
        ) : null}
        <Textarea
          name="decisionReason"
          label="Motivo da decisão"
          helperText="Ex.: por que não participou ou por que ultrapassou o limite."
          rows={3}
          maxLength={5_000}
          defaultValue={value("decisionReason", current?.decisionReason)}
          error={fieldError(state, "decisionReason")}
        />
        <Textarea
          name="notes"
          label="Observações"
          rows={3}
          maxLength={5_000}
          defaultValue={value("notes", current?.notes)}
          error={fieldError(state, "notes")}
        />
      </fieldset>

      {isCorrection ? (
        <fieldset className="grid gap-4">
          <legend className="mb-4 text-heading-3 text-foreground">Correção</legend>
          <Textarea
            name="correctionReason"
            label="Motivo da correção"
            required
            rows={2}
            maxLength={2_000}
            defaultValue={value("correctionReason")}
            error={fieldError(state, "correctionReason")}
          />
        </fieldset>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 md:flex-row md:justify-end">
        <Button asChild variant="secondary">
          <Link href={`/lotes/${context.lot.id}` as Route}>Cancelar</Link>
        </Button>
        <Button type="submit" loading={pending} loadingLabel="Salvando…">
          {isCorrection ? "Salvar correção" : "Registrar resultado"}
        </Button>
      </div>
    </form>
  );
}
