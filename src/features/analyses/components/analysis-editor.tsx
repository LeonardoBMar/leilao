"use client";

import { Calculator, Lock, Save, Trash2 } from "lucide-react";
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
import { parseBRL } from "@/domain/money";
import { fieldError, fieldValue, idleState } from "@/lib/action-state";
import { toCalendarDateInput, toMonthInput } from "@/lib/dates";
import { formatBps } from "@/lib/format";

import { discardDraftAction, saveAnalysisAction } from "../actions";
import { FIXED_COST_LABELS } from "../labels";
import { readAnalysisInputs } from "../read-inputs";
import { liveSummary } from "../summary-model";
import type { AnalysisDetail } from "../types";
import { AnalysisSummary } from "./analysis-summary";

const centsToInput = (value: number | null) =>
  value === null ? undefined : (value / 100).toFixed(2).replace(".", ",");
const bpsToInput = (value: number | null) =>
  value === null
    ? undefined
    : (value / 100)
        .toFixed(2)
        .replace(/\.?0+$/, "")
        .replace(".", ",");

type MoneyField = (typeof FIXED_COST_LABELS)[number][0] | "riskReserve" | "desiredMargin";

/** Rascunho da análise (SPEC `/analise/[id]`, RF-04): formulário + resumo ao vivo. */
export function AnalysisEditor({ analysis }: { analysis: AnalysisDetail }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(saveAnalysisAction.bind(null, analysis.id), idleState);
  const [inputs, setInputs] = useState(analysis.inputs);
  const [mode, setMode] = useState<CommissionMode | "">(analysis.inputs.commissionMode ?? "");
  const [intent, setIntent] = useState<"draft" | "fix">("draft");
  // "Estimar a partir da FIPE" remonta o formulário com os valores atuais mais os estimados (campos não controlados).
  const [prefill, setPrefill] = useState<Record<string, string> | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  function recompute(overrides?: Record<string, string>) {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    for (const [key, value] of Object.entries(overrides ?? {})) formData.set(key, value);
    setInputs(readAnalysisInputs(formData));
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
    toast.success("Valor de venda e reparos estimados a partir da FIPE.");
  }

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

  return (
    <div className="grid items-start gap-9 xl:grid-cols-[minmax(0,1fr)_28.75rem] xl:gap-14">
      <form
        key={formKey}
        ref={formRef}
        action={formAction}
        onInput={() => recompute()}
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
          <div>
            <Button type="button" variant="secondary" className="md:mt-7" onClick={estimateSaleAndRepairs}>
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
          <p className="-mt-2 text-caption text-muted md:col-span-2">
            Informe 0 quando não houver o custo. Campo vazio significa “não informado” e impede a fixação.
          </p>
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

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 md:flex-row md:items-center">
          <DiscardDraftButton analysisId={analysis.id} />
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
      </form>

      <AnalysisSummary model={liveSummary(inputs)} currentBid={analysis.lot.currentBid} />
    </div>
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
