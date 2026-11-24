"use client";

import { RotateCcw } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  Alert,
  AlertDescription,
  Button,
  CurrencyInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Section,
  SectionHeader,
  SectionTitle,
} from "@/components/ui";
import { DEFAULT_COSTS, SALE_DISCOUNT_BPS } from "@/domain/finance/defaults";
import { DEFAULT_REGION } from "@/domain/listings/region";
import type { Bps } from "@/domain/money";
import { fieldError, fieldValue, idleState } from "@/lib/action-state";
import { formatBps, formatBRL, formatMoneyInput } from "@/lib/format";

import { resetUserPreferencesAction, saveUserPreferencesAction } from "../actions";
import type { UserPreferences } from "../types";
import { MunicipalityPicker } from "./municipality-picker";

function formatPercentInput(value: Bps | null): string {
  if (value === null) return "";
  return (value / 100).toString().replace(".", ",");
}

type PreferencesFormProps = {
  preferences: UserPreferences;
};

export function PreferencesForm({ preferences }: PreferencesFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [saveState, saveAction, savePending] = useActionState(saveUserPreferencesAction, idleState);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(async (prev: typeof idleState) => {
    const result = await resetUserPreferencesAction(prev);
    setConfirmResetOpen(false);
    return result;
  }, idleState);
  const [lastAction, setLastAction] = useState<"save" | "reset" | null>(null);

  useEffect(() => {
    if (lastAction !== "save" || saveState.status !== "error" || !saveState.fieldErrors) return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalid?.focus();
    firstInvalid?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [lastAction, saveState]);

  const { raw } = preferences;
  const activeAlert =
    lastAction === "reset"
      ? resetState.status !== "idle"
        ? resetState
        : null
      : lastAction === "save"
        ? saveState.status !== "idle"
          ? saveState
          : null
        : null;
  const fieldErrorCount =
    activeAlert?.status === "error" && activeAlert.fieldErrors ? Object.keys(activeAlert.fieldErrors).length : 0;
  const formResetKey = raw.updatedAt?.toISOString() ?? "default";

  return (
    <div className="grid gap-8">
      {activeAlert?.status === "success" && activeAlert.message ? (
        <Alert variant="success">
          <AlertDescription>{activeAlert.message}</AlertDescription>
        </Alert>
      ) : null}

      {activeAlert?.status === "error" ? (
        <Alert variant="error">
          <AlertDescription>
            {fieldErrorCount > 0
              ? `Revise ${fieldErrorCount === 1 ? "o campo destacado" : `os ${fieldErrorCount} campos destacados`} antes de salvar.`
              : activeAlert.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        ref={formRef}
        key={formResetKey}
        action={saveAction}
        onSubmit={() => setLastAction("save")}
        className="grid gap-8"
      >
        <Section>
          <SectionHeader>
            <SectionTitle>Região base</SectionTitle>
          </SectionHeader>
          <p className="text-body text-muted">
            Usada para calcular distâncias até os pátios, o resumo “Na sua região” e o guincho estimado nos rascunhos.
            Não altera o coletor global.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <MunicipalityPicker
              initialIbgeCode={raw.municipalityIbgeCode}
              initialLabel={raw.municipalityLabel}
              error={fieldError(saveState, "municipalityIbgeCode")}
            />
            <Input
              name="radiusKm"
              label="Raio da região"
              suffix="km"
              inputMode="numeric"
              className="tabular-nums"
              placeholder={String(DEFAULT_REGION.radiusKm)}
              defaultValue={fieldValue(saveState, "radiusKm") ?? (raw.radiusKm !== null ? String(raw.radiusKm) : "")}
              error={fieldError(saveState, "radiusKm")}
              helperText={`Entre 10 e 5.000 km. Padrão do sistema: ${DEFAULT_REGION.radiusKm} km.`}
            />
          </div>
        </Section>

        <Section className="border-t border-border pt-6">
          <SectionHeader>
            <SectionTitle>Premissas padrão da calculadora</SectionTitle>
          </SectionHeader>
          <p className="text-body text-muted">
            Campos em branco mantêm o padrão pessimista do sistema. Quando o anúncio informa taxa própria (despachante
            ou remoção), o valor do anúncio continua tendo precedência.
          </p>

          <div className="grid gap-6">
            <div className="grid gap-3">
              <div>
                <h3 className="text-label font-semibold text-foreground">Margem, reserva e documentação</h3>
                <p className="text-caption text-muted">
                  Percentuais aplicados sobre o valor de venda estimado e custo fixo de despachante/transferência.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  name="desiredMarginRateBps"
                  label="Margem desejada"
                  suffix="%"
                  inputMode="decimal"
                  className="tabular-nums"
                  placeholder={formatPercentInput(DEFAULT_COSTS.desiredMarginRate)}
                  defaultValue={
                    fieldValue(saveState, "desiredMarginRateBps") ?? formatPercentInput(raw.desiredMarginRateBps)
                  }
                  error={fieldError(saveState, "desiredMarginRateBps")}
                  helperText={`Sobre o valor de venda. Padrão: ${formatBps(DEFAULT_COSTS.desiredMarginRate)}.`}
                />
                <Input
                  name="riskReserveRateBps"
                  label="Reserva de risco"
                  suffix="%"
                  inputMode="decimal"
                  className="tabular-nums"
                  placeholder={formatPercentInput(DEFAULT_COSTS.riskReserveRate)}
                  defaultValue={
                    fieldValue(saveState, "riskReserveRateBps") ?? formatPercentInput(raw.riskReserveRateBps)
                  }
                  error={fieldError(saveState, "riskReserveRateBps")}
                  helperText={`Sobre o valor de venda. Padrão: ${formatBps(DEFAULT_COSTS.riskReserveRate)}.`}
                />
                <CurrencyInput
                  name="documentationCost"
                  label="Documentação padrão"
                  placeholder={formatMoneyInput(DEFAULT_COSTS.documentation)}
                  defaultValue={
                    fieldValue(saveState, "documentationCost") ??
                    (raw.documentationCost !== null ? formatMoneyInput(raw.documentationCost) : "")
                  }
                  error={fieldError(saveState, "documentationCost")}
                  helperText={`Padrão: ${formatBRL(DEFAULT_COSTS.documentation)}.`}
                />
              </div>
            </div>

            <div className="grid gap-3 border-t border-border pt-5">
              <div>
                <h3 className="text-label font-semibold text-foreground">Guincho e transporte</h3>
                <p className="text-caption text-muted">
                  Cálculo automático da remoção quando o anúncio não informa taxa própria.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <CurrencyInput
                  name="towBase"
                  label="Guincho — saída fixa"
                  placeholder={formatMoneyInput(DEFAULT_COSTS.towBase)}
                  defaultValue={
                    fieldValue(saveState, "towBase") ?? (raw.towBase !== null ? formatMoneyInput(raw.towBase) : "")
                  }
                  error={fieldError(saveState, "towBase")}
                  helperText={`Padrão: ${formatBRL(DEFAULT_COSTS.towBase)}.`}
                />
                <CurrencyInput
                  name="towPerKm"
                  label="Guincho — valor por km"
                  placeholder={formatMoneyInput(DEFAULT_COSTS.towPerKm)}
                  defaultValue={
                    fieldValue(saveState, "towPerKm") ?? (raw.towPerKm !== null ? formatMoneyInput(raw.towPerKm) : "")
                  }
                  error={fieldError(saveState, "towPerKm")}
                  helperText={`Por km de estrada (linha reta × 1,3). Padrão: ${formatBRL(DEFAULT_COSTS.towPerKm)}.`}
                />
                <CurrencyInput
                  name="towUnknownDistance"
                  label="Guincho — sem local definido"
                  placeholder={formatMoneyInput(DEFAULT_COSTS.towUnknownDistance)}
                  defaultValue={
                    fieldValue(saveState, "towUnknownDistance") ??
                    (raw.towUnknownDistance !== null ? formatMoneyInput(raw.towUnknownDistance) : "")
                  }
                  error={fieldError(saveState, "towUnknownDistance")}
                  helperText={`Quando o pátio não tem cidade. Padrão: ${formatBRL(DEFAULT_COSTS.towUnknownDistance)}.`}
                />
              </div>
            </div>

            <div className="grid gap-3 border-t border-border pt-5">
              <div>
                <h3 className="text-label font-semibold text-foreground">Desconto sobre a FIPE por monta</h3>
                <p className="text-caption text-muted">
                  Redução aplicada à tabela FIPE para estimar o valor de venda conforme a monta declarada.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  name="saleDiscountNoneBps"
                  label="Sem monta"
                  suffix="%"
                  inputMode="decimal"
                  className="tabular-nums"
                  placeholder={formatPercentInput(SALE_DISCOUNT_BPS.none)}
                  defaultValue={
                    fieldValue(saveState, "saleDiscountNoneBps") ?? formatPercentInput(raw.saleDiscountNoneBps)
                  }
                  error={fieldError(saveState, "saleDiscountNoneBps")}
                  helperText={`Padrão: ${formatBps(SALE_DISCOUNT_BPS.none)}.`}
                />
                <Input
                  name="saleDiscountSmallBps"
                  label="Pequena monta"
                  suffix="%"
                  inputMode="decimal"
                  className="tabular-nums"
                  placeholder={formatPercentInput(SALE_DISCOUNT_BPS.small)}
                  defaultValue={
                    fieldValue(saveState, "saleDiscountSmallBps") ?? formatPercentInput(raw.saleDiscountSmallBps)
                  }
                  error={fieldError(saveState, "saleDiscountSmallBps")}
                  helperText={`Padrão: ${formatBps(SALE_DISCOUNT_BPS.small)}.`}
                />
                <Input
                  name="saleDiscountMediumBps"
                  label="Média monta"
                  suffix="%"
                  inputMode="decimal"
                  className="tabular-nums"
                  placeholder={formatPercentInput(SALE_DISCOUNT_BPS.medium)}
                  defaultValue={
                    fieldValue(saveState, "saleDiscountMediumBps") ?? formatPercentInput(raw.saleDiscountMediumBps)
                  }
                  error={fieldError(saveState, "saleDiscountMediumBps")}
                  helperText={`Padrão: ${formatBps(SALE_DISCOUNT_BPS.medium)}.`}
                />
                <Input
                  name="saleDiscountLargeBps"
                  label="Grande monta"
                  suffix="%"
                  inputMode="decimal"
                  className="tabular-nums"
                  placeholder={formatPercentInput(SALE_DISCOUNT_BPS.large)}
                  defaultValue={
                    fieldValue(saveState, "saleDiscountLargeBps") ?? formatPercentInput(raw.saleDiscountLargeBps)
                  }
                  error={fieldError(saveState, "saleDiscountLargeBps")}
                  helperText={`Padrão: ${formatBps(SALE_DISCOUNT_BPS.large)}.`}
                />
              </div>
            </div>
          </div>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={!preferences.hasOverrides || savePending || resetPending}
              onClick={() => setConfirmResetOpen(true)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Restaurar padrões
            </Button>
            {!preferences.hasOverrides ? (
              <span className="text-caption text-muted">Usando os padrões do sistema</span>
            ) : null}
          </div>
          <Button type="submit" loading={savePending} loadingLabel="Salvando…" disabled={resetPending}>
            Salvar preferências
          </Button>
        </div>
      </form>

      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar padrões do sistema?</DialogTitle>
            <DialogDescription>
              Sua região base voltará para {DEFAULT_REGION.label} ({DEFAULT_REGION.radiusKm} km) e todas as premissas
              personalizadas serão removidas. Análises já fixadas não serão alteradas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmResetOpen(false)}>
              Cancelar
            </Button>
            <form action={resetAction} onSubmit={() => setLastAction("reset")} className="w-full sm:w-auto">
              <Button
                type="submit"
                variant="destructive"
                loading={resetPending}
                loadingLabel="Restaurando…"
                className="w-full sm:w-auto"
              >
                Restaurar padrões
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
