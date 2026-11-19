"use client";

import { Calculator, FileInput, Lock, Save, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
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
  RadioGroup,
  RadioItem,
  Textarea,
  toast,
} from "@/components/ui";
import type { CommissionMode } from "@/domain/finance/calculator";
import { estimateFromFipe } from "@/domain/finance/defaults";
import { type Cents, parseBRL } from "@/domain/money";
import type { LotMarketReference } from "@/features/research/types";
import { fieldError, fieldValue, idleState } from "@/lib/action-state";
import { toCalendarDateInput, toMonthInput } from "@/lib/dates";
import { formatBps, formatBRL, formatMoneyInput, formatTime } from "@/lib/format";

import { autosaveDraftAction, discardDraftAction, saveAnalysisAction } from "../actions";
import { fipeFill } from "../fipe-fill";
import { FIELD_LABELS, FIXED_COST_LABELS } from "../labels";
import { readAnalysisInputs } from "../read-inputs";
import { liveSummary, type SummaryModel } from "../summary-model";
import type { AnalysisDetail } from "../types";
import { AnalysisSummary } from "./analysis-summary";

/** Espera depois da última digitação antes de salvar sozinho. */
const AUTOSAVE_DELAY_MS = 1500;

type AutosaveStatus =
  { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "invalid" | "failed" };

const centsToInput = (value: Cents | null) => (value === null ? undefined : formatMoneyInput(value));
const bpsToInput = (value: number | null) =>
  value === null
    ? undefined
    : (value / 100)
        .toFixed(2)
        .replace(/\.?0+$/, "")
        .replace(".", ",");

type MoneyField = (typeof FIXED_COST_LABELS)[number][0] | "riskReserve" | "desiredMargin";

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
  const money = (name: MoneyField, label: string, helperText?: string) => (
    <CurrencyInput
      name={name}
      label={label}
      helperText={helperText}
      defaultValue={value(name, centsToInput(saved[name]))}
      error={fieldError(state, name)}
    />
  );

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
            {analysis.listingFipe === null ? null : (
              <Button type="button" variant="secondary" onClick={applyListingFipe}>
                <FileInput aria-hidden="true" />
                Usar FIPE do anúncio ({formatBRL(analysis.listingFipe.value)})
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={estimateSaleAndRepairs}>
              <Calculator aria-hidden="true" />
              Estimar a partir da FIPE
            </Button>
          </div>
          <CurrencyInput
            name="marketValue"
            label="Valor de venda esperado"
            helperText="Quanto o veículo vale após os reparos. Padrão: FIPE menos o desconto pela condição."
            containerClassName="md:col-span-2"
            defaultValue={value("marketValue", centsToInput(saved.marketValue))}
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

        <fieldset className="grid gap-4 md:grid-cols-2 md:gap-6">
          <legend className="mb-4 text-heading-3 text-foreground">Custos fixos</legend>
          <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 md:col-span-2">
            <p className="text-caption text-muted">
              Informe 0 quando não houver o custo. Campo vazio significa “não informado” e impede a fixação.
            </p>
            {emptyFixedCostCount > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={zeroEmptyFixedCosts}>
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
              onValueChange={(next) => {
                setMode(next === "fixed" || next === "percentage" ? next : "");
                recompute({ commissionMode: next });
              }}
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
          {percent(
            "desiredMarginRate",
            "Margem desejada (%)",
            "Do valor de venda: lucro pretendido ou economia mínima.",
          )}
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

/** Barra inferior fixa em telas abaixo de `lg` (DESIGN.md §10): mantém o lance máximo visível durante a edição. */
function MobileMaxBidBar({ model, pending, onFix }: { model: SummaryModel; pending: boolean; onFix: () => void }) {
  const { outcome } = model;
  return (
    <div
      aria-label="Resumo rápido da análise"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border-strong bg-surface px-4 py-3 shadow-md lg:hidden"
    >
      <div className="mx-auto flex max-w-360 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-muted">Lance máximo</p>
          {outcome.kind === "viable" ? (
            <p className="truncate text-heading-2 font-semibold text-foreground tabular-nums">
              {formatBRL(outcome.maxBid)}
            </p>
          ) : outcome.kind === "not_viable" ? (
            <p className="truncate text-label font-semibold text-warning">Sem lance viável</p>
          ) : (
            <p className="truncate text-label text-muted">
              Falta: {outcome.missing.map((field) => FIELD_LABELS[field]).join(", ")}
            </p>
          )}
        </div>
        <Button type="button" size="sm" onClick={onFix} loading={pending} loadingLabel="Fixando…">
          <Lock aria-hidden="true" />
          Fixar análise
        </Button>
      </div>
    </div>
  );
}

function AutosaveText({ status }: { status: AutosaveStatus }) {
  const text = {
    idle: null,
    saving: "Salvando…",
    saved: status.kind === "saved" ? `Salvo às ${formatTime(status.at)}` : null,
    invalid: "Não salvo: revise os campos",
    failed: "Não foi possível salvar sozinho",
  }[status.kind];
  if (!text) return null;
  return (
    <p
      className={
        status.kind === "invalid" || status.kind === "failed" ? "text-caption text-warning" : "text-caption text-muted"
      }
      aria-live="polite"
    >
      {text}
    </p>
  );
}

function DiscardDraftButton({ analysisId }: { analysisId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost">
          <Trash2 aria-hidden="true" />
          Descartar rascunho
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar rascunho?</DialogTitle>
          <DialogDescription>
            Os dados deste rascunho serão removidos. Versões fixadas não são afetadas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Voltar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={isPending}
            loadingLabel="Descartando…"
            onClick={() =>
              startTransition(async () => {
                const result = await discardDraftAction(analysisId);
                if (result.status === "error") toast.error(result.message);
              })
            }
          >
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
