"use client";

import { Lock, Save } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, Button, toast } from "@/components/ui";
import type { CommissionMode } from "@/domain/finance/calculator";
import { estimateFromFipe } from "@/domain/finance/defaults";
import { type Cents, parseBRL } from "@/domain/money";
import type { LotMarketReference } from "@/features/research/types";
import { fieldValue, idleState } from "@/lib/action-state";
import { formatBps, formatMoneyInput } from "@/lib/format";

import { autosaveDraftAction, saveAnalysisAction } from "../actions";
import { fipeFill } from "../fipe-fill";
import { FIELD_LABELS, FIXED_COST_LABELS } from "../labels";
import { readAnalysisInputs } from "../read-inputs";
import { liveSummary } from "../summary-model";
import type { AnalysisDetail } from "../types";
import { AnalysisCostsSection } from "./analysis-costs-section";
import { type AutosaveStatus, AutosaveText, DiscardDraftButton, MobileMaxBidBar } from "./analysis-mobile-bar";
import { AnalysisReferencesSection } from "./analysis-references-section";
import { AnalysisSummary } from "./analysis-summary";

/** Espera depois da última digitação antes de salvar sozinho. */
const AUTOSAVE_DELAY_MS = 1500;

const centsToInput = (value: Cents | null) => (value === null ? undefined : formatMoneyInput(value));

/** Rascunho da análise (SPEC `/analise/[id]`, RF-04): formulário + resumo ao vivo. */
export function AnalysisEditor({ analysis, market }: { analysis: AnalysisDetail; market: LotMarketReference | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(saveAnalysisAction.bind(null, analysis.id), idleState);
  const [inputs, setInputs] = useState(analysis.inputs);
  const [mode, setMode] = useState<CommissionMode | "">(analysis.inputs.commissionMode ?? "");
  const [intent, setIntent] = useState<"draft" | "fix">("draft");
  // "Estimar a partir da FIPE" remonta o formulário com os valores atuais mais os estimados (campos não controlados).
  const [prefill, setPrefill] = useState<Record<string, string> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [autosave, setAutosave] = useState<AutosaveStatus>({ kind: "idle" });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autosaveSeqRef = useRef(0);
  const hasPendingAutosaveRef = useRef(false);
  const isSavingAutosave = autosave.kind === "saving";

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
      return;
    }
    if (state.status === "error" && state.fieldErrors && formRef.current) {
      const firstErrorField = Object.keys(state.fieldErrors)[0];
      if (!firstErrorField) return;
      const target =
        firstErrorField === "commissionMode"
          ? formRef.current.querySelector<HTMLElement>('[role="radiogroup"] [role="radio"]')
          : formRef.current.elements.namedItem(firstErrorField);
      if (target instanceof HTMLElement) {
        target.focus();
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [state]);

  useEffect(() => {
    const seq = autosaveSeqRef;
    const pendingFlag = hasPendingAutosaveRef;
    return () => {
      clearTimeout(autosaveTimer.current);
      seq.current += 1;
      pendingFlag.current = false;
    };
  }, []);

  useEffect(() => {
    function warnUnsaved(event: BeforeUnloadEvent) {
      if (!hasPendingAutosaveRef.current && !isSavingAutosave) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, [isSavingAutosave]);

  function cancelAutosave() {
    clearTimeout(autosaveTimer.current);
    autosaveSeqRef.current += 1;
    hasPendingAutosaveRef.current = false;
  }

  /** Rascunho salvo sozinho após uma pausa na digitação, com o status discreto no rodapé. */
  function scheduleAutosave(overrides?: Record<string, string>) {
    clearTimeout(autosaveTimer.current);
    hasPendingAutosaveRef.current = true;
    autosaveTimer.current = setTimeout(() => {
      if (!formRef.current) {
        hasPendingAutosaveRef.current = false;
        return;
      }
      const seq = ++autosaveSeqRef.current;
      const formData = new FormData(formRef.current);
      for (const [key, value] of Object.entries(overrides ?? {})) formData.set(key, value);
      setAutosave({ kind: "saving" });
      void autosaveDraftAction(analysis.id, formData).then(
        (result) => {
          if (seq !== autosaveSeqRef.current) return;
          hasPendingAutosaveRef.current = false;
          setAutosave(result === "saved" ? { kind: "saved", at: new Date() } : { kind: result });
        },
        () => {
          if (seq !== autosaveSeqRef.current) return;
          hasPendingAutosaveRef.current = false;
          setAutosave({ kind: "failed" });
        },
      );
    }, AUTOSAVE_DELAY_MS);
  }

  function recompute(overrides?: Record<string, string>) {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    for (const [key, value] of Object.entries(overrides ?? {})) formData.set(key, value);
    setInputs(readAnalysisInputs(formData));
    scheduleAutosave(overrides);
  }

  function estimateSaleAndRepairs() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const typed = formData.get("fipeValue");
    const fipe = typeof typed === "string" ? parseBRL(typed) : null;
    if (fipe === null || fipe <= 0) {
      toast.error("Informe a FIPE para estimar.");
      return;
    }
    const estimate = estimateFromFipe({ fipe, ...analysis.vehicle });
    if (estimate.marketValue === null || estimate.repairCost === null || estimate.saleDiscount === null) {
      toast.error("Sucata não tem valor de venda padrão. Informe o valor de venda e os reparos.");
      return;
    }
    const current: Record<string, string> = {};
    for (const [key, entry] of formData) if (typeof entry === "string") current[key] = entry;
    const next = {
      ...current,
      marketValue: centsToInput(estimate.marketValue) ?? "",
      repairCost: centsToInput(estimate.repairCost) ?? "",
      marketReferenceSource: `FIPE − ${formatBps(estimate.saleDiscount)} (premissa padrão)`,
    };
    for (const [key, entry] of Object.entries(next)) formData.set(key, entry);
    setPrefill(next);
    setFormKey((key) => key + 1);
    setInputs(readAnalysisInputs(formData));
    scheduleAutosave(next);
    toast.success("Valor de venda e reparos estimados a partir da FIPE.");
  }

  /** Referência FIPE do anúncio ligado, só nos campos vazios (nunca sobrescreve o que foi digitado). */
  function applyListingFipe() {
    if (!formRef.current || analysis.listingFipe === null) return;
    const formData = new FormData(formRef.current);
    const current: Record<string, string> = {};
    for (const [key, entry] of formData) if (typeof entry === "string") current[key] = entry;
    const fill = fipeFill(
      {
        fipeValue: current.fipeValue ?? "",
        fipeReferenceMonth: current.fipeReferenceMonth ?? "",
        fipeReferenceSource: current.fipeReferenceSource ?? "",
      },
      analysis.listingFipe,
    );
    if (Object.keys(fill).length === 0) {
      toast.info("A referência FIPE já está preenchida. Apague o valor para usar a do anúncio.");
      return;
    }
    const next = { ...current, ...fill };
    for (const [key, entry] of Object.entries(next)) formData.set(key, entry);
    setPrefill(next);
    setFormKey((key) => key + 1);
    setInputs(readAnalysisInputs(formData));
    scheduleAutosave(next);
    toast.success(
      fill.fipeValue === undefined
        ? "Mês e fonte da FIPE preenchidos com os do anúncio."
        : "FIPE do anúncio preenchida.",
    );
  }

  /** Preenche apenas os custos fixos ainda vazios com 0,00, mediante ação explícita do usuário (SPEC §7.6). */
  function zeroEmptyFixedCosts() {
    if (!formRef.current) return;
    let filled = 0;
    for (const [name] of FIXED_COST_LABELS) {
      const input = formRef.current.elements.namedItem(name);
      if (input instanceof HTMLInputElement && input.value.trim() === "") {
        input.value = "0,00";
        filled += 1;
      }
    }
    if (filled === 0) {
      toast.info("Nenhum custo vazio encontrado; revise valores inválidos.");
      return;
    }
    recompute();
    toast.success(
      filled === 1 ? "1 custo vazio preenchido com R$ 0,00." : `${filled} custos vazios preenchidos com R$ 0,00.`,
    );
  }

  const emptyFixedCostCount = FIXED_COST_LABELS.filter(([name]) => inputs[name] === null).length;
  const { inputs: saved, references } = analysis;
  const value = (field: string, stored?: string) => fieldValue(state, field) ?? prefill?.[field] ?? stored;
  const summaryModel = liveSummary(inputs);
  const missingFields = summaryModel.outcome.kind === "incomplete" ? summaryModel.outcome.missing : [];

  return (
    <div className="grid items-start gap-9 pb-24 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 lg:pb-0 xl:grid-cols-[minmax(0,1fr)_28.75rem] xl:gap-14">
      <form
        key={formKey}
        ref={formRef}
        action={formAction}
        onInput={() => recompute()}
        onSubmit={() => cancelAutosave()}
        noValidate
        className="grid content-start gap-8"
      >
        {state.status === "error" ? (
          <Alert variant={state.fieldErrors ? "warning" : "error"}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <AnalysisReferencesSection
          state={state}
          marketValue={saved.marketValue}
          references={references}
          listingFipe={analysis.listingFipe}
          value={value}
          onApplyListingFipe={applyListingFipe}
          onEstimateSaleAndRepairs={estimateSaleAndRepairs}
        />

        <AnalysisCostsSection
          state={state}
          saved={saved}
          references={references}
          mode={mode}
          prefill={prefill}
          emptyFixedCostCount={emptyFixedCostCount}
          value={value}
          onZeroEmptyFixedCosts={zeroEmptyFixedCosts}
          onModeChange={(next) => {
            setMode(next === "fixed" || next === "percentage" ? next : "");
            recompute({ commissionMode: next });
          }}
        />

        <div className="grid gap-3 border-t border-border pt-6">
          {missingFields.length > 0 ? (
            <p className="text-caption text-warning" role="status">
              Falta para fixar: {missingFields.map((field) => FIELD_LABELS[field]).join(", ")}.
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center">
            <DiscardDraftButton analysisId={analysis.id} />
            <AutosaveText status={autosave} />
            <div className="flex flex-col-reverse gap-3 md:ml-auto md:flex-row">
              <Button
                type="submit"
                name="intent"
                value="draft"
                variant="secondary"
                onClick={() => setIntent("draft")}
                loading={pending && intent === "draft"}
                loadingLabel="Salvando…"
              >
                <Save aria-hidden="true" />
                Salvar rascunho
              </Button>
              {/* Fixar é seguro sem confirmação: "Revisar premissas" cria a próxima versão. */}
              <Button
                type="submit"
                name="intent"
                value="fix"
                onClick={() => setIntent("fix")}
                loading={pending && intent === "fix"}
                loadingLabel="Fixando…"
              >
                <Lock aria-hidden="true" />
                Fixar análise
              </Button>
            </div>
          </div>
        </div>
      </form>

      <AnalysisSummary model={summaryModel} currentBid={analysis.lot.currentBid} market={market} />

      <MobileMaxBidBar
        model={summaryModel}
        pending={pending && intent === "fix"}
        onFix={() => {
          cancelAutosave();
          setIntent("fix");
          const fixButton = formRef.current?.querySelector<HTMLButtonElement>('button[name="intent"][value="fix"]');
          fixButton?.click();
        }}
      />
    </div>
  );
}
