"use client";

import { FilePen, Trophy } from "lucide-react";
import { useActionState, useState } from "react";

import {
  Alert,
  AlertDescription,
  Button,
  type ButtonProps,
  CurrencyInput,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  SegmentedControl,
  SelectField,
  toast,
} from "@/components/ui";
import type { Cents } from "@/domain/money";
import { LOT_OUTCOMES, type LotOutcome, PERSONAL_OUTCOMES, type PersonalOutcome } from "@/domain/results/results";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";
import { toZonedDateInput } from "@/lib/dates";
import { formatBRL, formatDate, formatMoneyInput } from "@/lib/format";

import type { LotResultContext } from "../types";

type ResultAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type ResultDialogProps = {
  action: ResultAction;
  context: LotResultContext;
  /** Texto do botão que abre o modal; o padrão segue o estado do resultado. */
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

/** Rótulos curtos para caber no controle segmentado do modal. */
const OUTCOME_SHORT_LABELS = {
  sold: "Arrematado",
  unsold: "Sem venda",
  withdrawn: "Retirado",
  cancelled: "Cancelado",
  unknown: "Não sei",
} satisfies Record<LotOutcome, string>;

const SHORT_PERSONAL_LABELS = {
  observed: "Só observei",
  bid_not_won: "Dei lance",
  won: "Arrematei",
} satisfies Record<PersonalOutcome, string>;

const centsToInput = (value: Cents | null) => (value === null ? undefined : formatMoneyInput(value));

/**
 * Registro ou correção do resultado num modal, sem sair da tela (D-54; SPEC RF-06). Pede só desfecho, preço e dia;
 * o horário, a fonte e a análise vinculada vêm do que o lote já sabe.
 */
export function ResultDialog({ action, context, label, variant = "secondary", size }: ResultDialogProps) {
  const [open, setOpen] = useState(false);
  const isCorrection = context.current !== null;
  const toConfirm = !isCorrection && context.tracking?.outcome.kind === "to_confirm";
  const text =
    label ?? (isCorrection ? "Corrigir resultado" : toConfirm ? "Confirmar resultado" : "Registrar resultado");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {isCorrection ? <FilePen aria-hidden="true" /> : <Trophy aria-hidden="true" />}
          {text}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Corrigir resultado" : "Registrar resultado"}</DialogTitle>
          <DialogDescription>
            Lote {context.lot.lotNumber} · {context.lot.title}
          </DialogDescription>
        </DialogHeader>
        <ResultForm action={action} context={context} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ResultForm({
  action,
  context,
  onSaved,
}: {
  action: ResultAction;
  context: LotResultContext;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const next = await action(prev, formData);
    if (next.status === "success") {
      onSaved();
      if (next.message) toast.success(next.message);
    }
    return next;
  }, idleState);

  const { current, prefill } = context;
  const initialOutcome = LOT_OUTCOMES.find((item) => item === fieldValue(state, "outcome"));
  const [outcome, setOutcome] = useState<LotOutcome>(initialOutcome ?? current?.outcome ?? prefill?.outcome ?? "sold");
  const [personal, setPersonal] = useState<PersonalOutcome>(current?.personalOutcome ?? "observed");
  const [analysisId, setAnalysisId] = useState(current?.analysis?.id ?? context.suggestedAnalysisId ?? "none");

  const eventAt = current ? current.eventAt : (prefill?.eventAt ?? null);
  const today = toZonedDateInput(new Date());
  const finalBid = current ? current.finalBid : (prefill?.finalBid ?? context.lot.currentBid);
  const isSold = outcome === "sold";

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="baseRevision" value={current?.revision ?? 0} />
      <input type="hidden" name="analysisId" value={analysisId} />

      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {prefill ? (
        <Alert variant={prefill.outcome ? "info" : "warning"}>
          <AlertDescription>
            {prefill.outcome
              ? "Preenchido com o desfecho do site do leilão. Confira e salve."
              : "O site não confirmou o desfecho. O último lance coletado já está preenchido."}
          </AlertDescription>
        </Alert>
      ) : null}

      <SegmentedControl
        name="outcome"
        label="Desfecho"
        value={outcome}
        onValueChange={(next) => {
          setOutcome(next);
          if (next !== "sold" && personal === "won") setPersonal("observed");
        }}
        options={LOT_OUTCOMES.map((item) => ({ value: item, label: OUTCOME_SHORT_LABELS[item] }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {isSold ? (
          <CurrencyInput
            name="finalBid"
            label="Preço final"
            autoFocus
            defaultValue={fieldValue(state, "finalBid") ?? centsToInput(finalBid)}
            error={fieldError(state, "finalBid")}
          />
        ) : null}
        <Input
          name="eventDate"
          type="date"
          label="Data"
          max={today}
          defaultValue={fieldValue(state, "eventDate") ?? (eventAt ? toZonedDateInput(eventAt) : today)}
          error={fieldError(state, "eventDate")}
        />
      </div>

      <div className="grid gap-2">
        <SegmentedControl
          name="personalOutcome"
          label="Minha participação"
          value={personal}
          onValueChange={setPersonal}
          options={PERSONAL_OUTCOMES.filter((item) => item !== "won" || isSold).map((item) => ({
            value: item,
            label: SHORT_PERSONAL_LABELS[item],
          }))}
        />
        {fieldError(state, "personalOutcome") ? (
          <p className="text-caption text-error" role="alert">
            {fieldError(state, "personalOutcome")}
          </p>
        ) : null}
      </div>

      {current ? (
        <Input
          name="correctionReason"
          label="Motivo da correção (opcional)"
          maxLength={2_000}
          defaultValue={fieldValue(state, "correctionReason")}
          error={fieldError(state, "correctionReason")}
        />
      ) : null}

      {context.fixedAnalyses.length > 0 ? (
        <details className="group" open={Boolean(fieldError(state, "analysisId"))}>
          <summary className="cursor-pointer text-caption text-muted hover:text-foreground">
            Comparar com a análise{" "}
            {analysisId === "none"
              ? "(nenhuma)"
              : `v${context.fixedAnalyses.find((item) => item.id === analysisId)?.version ?? ""}`}
          </summary>
          <SelectField
            className="mt-3"
            label="Análise vinculada"
            value={analysisId}
            onValueChange={setAnalysisId}
            options={[
              { value: "none", label: "Nenhuma" },
              ...context.fixedAnalyses.map((analysis) => ({
                value: analysis.id,
                label: `v${analysis.version} · ${formatDate(analysis.fixedAt)} · ${
                  analysis.isViable && analysis.maxBid !== null
                    ? `limite ${formatBRL(analysis.maxBid)}`
                    : "sem lance viável"
                }${analysis.knownResultAtCreation ? " · retrospectiva" : ""}`,
              })),
            ]}
            error={fieldError(state, "analysisId")}
          />
        </details>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancelar</Button>
        </DialogClose>
        <Button type="submit" loading={pending} loadingLabel="Salvando…">
          {current ? "Salvar correção" : "Registrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
