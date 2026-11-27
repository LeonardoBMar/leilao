"use client";

import { ArrowRight, Download, Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CurrencyInput,
  Input,
  Money,
  Section,
  SectionHeader,
  SectionTitle,
  SelectField,
  Textarea,
  toast,
} from "@/components/ui";
import { DAMAGE_LEVELS } from "@/domain/listings/condition";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";
import { toMonthInput } from "@/lib/dates";
import { formatBps, formatCompactBRL, formatMoneyInput } from "@/lib/format";

import { confirmImportAction, previewImportAction } from "../import-actions";
import type { ImportPreviewResult } from "../types";

const DAMAGE_OPTIONS = [
  { value: "", label: "Não informada / sem sinistro" },
  { value: "small", label: "Pequena monta" },
  { value: "medium", label: "Média monta" },
  { value: "large", label: "Grande monta" },
  { value: "salvage", label: "Sucata" },
];

const CONFIDENCE_LABELS = {
  high: { label: "Extração completa", variant: "success" as const },
  medium: { label: "Extração parcial — revise", variant: "warning" as const },
  low: { label: "Poucos dados — complete manualmente", variant: "outline" as const },
};

const initialPreviewState: ActionState<ImportPreviewResult> = { status: "idle" };

/** Fluxo em 2 passos do Importador Universal de Lotes (D-98). */
export function UniversalImportForm() {
  const [previewSeq, setPreviewSeq] = useState(0);
  const [previewState, previewAction, previewPending] = useActionState(
    async (prev: ActionState<ImportPreviewResult>, formData: FormData) => {
      const next = await previewImportAction(prev, formData);
      if (next.status === "success") {
        setPreviewSeq((seq) => seq + 1);
        if (next.message) toast.success(next.message);
      }
      return next;
    },
    initialPreviewState,
  );

  const preview = previewState.status === "success" ? (previewState.data ?? null) : null;

  return (
    <div className="grid gap-8">
      <Section className="grid gap-4">
        <SectionHeader>
          <div className="grid gap-1">
            <SectionTitle>1. Cole o link ou o texto do lote</SectionTitle>
            <p className="text-body text-muted">
              Funciona com Copart, Sodré Santoro, Freitas, Milan, Loop, VIP Leilões, Palácio dos Leilões ou qualquer
              outro leiloeiro. Se o site bloquear leitura automática, basta dar <kbd>Ctrl+A</kbd> → <kbd>Ctrl+C</kbd> na
              página do lote e colar abaixo.
            </p>
          </div>
        </SectionHeader>

        <form action={previewAction} noValidate className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          {previewState.status === "error" && !previewState.fieldErrors ? (
            <Alert variant="warning">
              <AlertDescription>{previewState.message}</AlertDescription>
            </Alert>
          ) : null}

          <Input
            name="url"
            label="URL da página do lote (opcional)"
            type="url"
            placeholder="https://www.copart.com.br/lot/..."
            defaultValue={fieldValue(previewState, "url") ?? ""}
            error={fieldError(previewState, "url")}
          />

          <Textarea
            name="rawText"
            label="Texto ou HTML copiado da página (opcional se a URL responder)"
            placeholder="Cole aqui o texto da página do lote (Ctrl+A → Ctrl+C no site do leiloeiro). Placa completa, chassi e Renavam são removidos automaticamente."
            rows={6}
            defaultValue={fieldValue(previewState, "rawText") ?? ""}
            error={fieldError(previewState, "rawText")}
          />

          <div className="flex justify-end">
            <Button type="submit" loading={previewPending} loadingLabel="Analisando lote…">
              <Sparkles aria-hidden="true" className="size-4" />
              Analisar e preencher
            </Button>
          </div>
        </form>
      </Section>

      {preview ? <ConfirmImportStep key={previewSeq} preview={preview} /> : null}
    </div>
  );
}

function ConfirmImportStep({ preview }: { preview: ImportPreviewResult }) {
  const { parsed, suggestedLotNumber, fipe, market } = preview;
  const [damageLevel, setDamageLevel] = useState<string>(parsed.damageLevel ?? "");
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmImportAction, idleState);
  const badge = CONFIDENCE_LABELS[parsed.confidence];

  const defaultLotNumber = suggestedLotNumber;

  return (
    <Section className="grid gap-5 border-t border-border pt-7">
      <SectionHeader>
        <div className="flex flex-wrap items-center gap-2.5">
          <SectionTitle>2. Confira os dados e abra o rascunho</SectionTitle>
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <Badge variant="outline">{parsed.auctioneer}</Badge>
        </div>
      </SectionHeader>

      <div className="grid gap-3 md:grid-cols-2">
        <Card variant="metric" className="grid gap-1 p-4">
          <p className="text-caption text-muted">Tabela FIPE casada no banco</p>
          <p className="text-heading-3 font-semibold text-foreground tabular-nums">
            {fipe ? <Money value={fipe.value} /> : "Não encontrada automaticamente"}
          </p>
          <p className="text-caption text-muted">
            {fipe
              ? `${fipe.label} (${fipe.origin === "fipe_version" ? "versão exata" : "família aproximada"})`
              : "Você pode preencher a FIPE manualmente abaixo ou no rascunho."}
          </p>
        </Card>

        <Card variant="metric" className="grid gap-1 p-4">
          <p className="text-caption text-muted">Faixa histórica no Mercado</p>
          <p className="text-heading-3 font-semibold text-foreground tabular-nums">
            {market && (market.kind === "comparables" || market.kind === "market_ratio")
              ? `${formatCompactBRL(market.low)} a ${formatCompactBRL(market.high)}`
              : "Sem base suficiente"}
          </p>
          <p className="text-caption text-muted tabular-nums">
            {market && market.kind === "comparables"
              ? `Mediana ${formatCompactBRL(market.median)} em ${market.n} vendas comparáveis`
              : market && market.kind === "market_ratio"
                ? `Mediana ${formatCompactBRL(market.median)} pela proporção da categoria (${market.n} vendas)`
                : "O rascunho nascerá com suas premissas padrão."}
          </p>
        </Card>
      </div>

      <form action={confirmAction} noValidate className="grid gap-5 rounded-lg border border-border bg-surface p-5">
        {confirmState.status === "error" && !confirmState.fieldErrors ? (
          <Alert variant="error">
            <AlertDescription>{confirmState.message}</AlertDescription>
          </Alert>
        ) : null}

        <input type="hidden" name="isMotorcycle" value={parsed.isMotorcycle ? "true" : "false"} />
        <input type="hidden" name="fuel" value={parsed.fuel ?? ""} />
        <input type="hidden" name="startsAtIso" value={parsed.startsAtIso ?? ""} />
        <input type="hidden" name="fipeRefMonth" value={fipe ? toMonthInput(fipe.refMonth) : ""} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            name="auctioneer"
            label="Leiloeiro"
            required
            defaultValue={fieldValue(confirmState, "auctioneer") ?? parsed.auctioneer}
            error={fieldError(confirmState, "auctioneer")}
          />
          <Input
            name="auctionName"
            label="Nome do leilão"
            required
            defaultValue={
              fieldValue(confirmState, "auctionName") ?? parsed.auctionName ?? `${parsed.auctioneer} (importado)`
            }
            error={fieldError(confirmState, "auctionName")}
          />
          <Input
            name="lotNumber"
            label="Número do lote"
            required
            defaultValue={fieldValue(confirmState, "lotNumber") ?? defaultLotNumber}
            error={fieldError(confirmState, "lotNumber")}
          />
          <Input
            name="brand"
            label="Marca"
            required
            defaultValue={fieldValue(confirmState, "brand") ?? parsed.brand ?? ""}
            error={fieldError(confirmState, "brand")}
          />
          <Input
            name="model"
            label="Modelo"
            required
            defaultValue={fieldValue(confirmState, "model") ?? parsed.model ?? ""}
            error={fieldError(confirmState, "model")}
          />
          <Input
            name="vehicleVersion"
            label="Versão"
            defaultValue={fieldValue(confirmState, "vehicleVersion") ?? parsed.vehicleVersion ?? ""}
            error={fieldError(confirmState, "vehicleVersion")}
          />
          <Input
            name="manufactureYear"
            label="Ano fabricação"
            type="number"
            className="tabular-nums"
            defaultValue={fieldValue(confirmState, "manufactureYear") ?? parsed.manufactureYear?.toString() ?? ""}
            error={fieldError(confirmState, "manufactureYear")}
          />
          <Input
            name="modelYear"
            label="Ano modelo"
            type="number"
            required
            className="tabular-nums"
            defaultValue={fieldValue(confirmState, "modelYear") ?? parsed.modelYear?.toString() ?? ""}
            error={fieldError(confirmState, "modelYear")}
          />
          <Input
            name="mileageKm"
            label="Quilometragem (km)"
            type="number"
            className="tabular-nums"
            defaultValue={fieldValue(confirmState, "mileageKm") ?? parsed.mileageKm?.toString() ?? ""}
            error={fieldError(confirmState, "mileageKm")}
          />
          <SelectField
            name="damageLevel"
            label="Condição / monta"
            options={DAMAGE_OPTIONS}
            value={damageLevel}
            onValueChange={(next) => {
              if (next === "" || DAMAGE_LEVELS.some((level) => level === next)) setDamageLevel(next);
            }}
            error={fieldError(confirmState, "damageLevel")}
          />
          <CurrencyInput
            name="currentBid"
            label="Lance atual"
            defaultValue={
              fieldValue(confirmState, "currentBid") ??
              (parsed.currentBidCents !== null ? formatMoneyInput(parsed.currentBidCents) : "")
            }
            error={fieldError(confirmState, "currentBid")}
          />
          <CurrencyInput
            name="fipeValue"
            label="Valor FIPE"
            defaultValue={fieldValue(confirmState, "fipeValue") ?? (fipe ? formatMoneyInput(fipe.value) : "")}
            error={fieldError(confirmState, "fipeValue")}
          />
          <Input
            name="commissionRateBps"
            label="Comissão (%)"
            placeholder="5"
            className="tabular-nums"
            defaultValue={
              fieldValue(confirmState, "commissionRateBps") ??
              (parsed.commissionRateBps !== null ? formatBps(parsed.commissionRateBps).replace("%", "") : "5")
            }
            error={fieldError(confirmState, "commissionRateBps")}
          />
          <CurrencyInput
            name="otherFees"
            label="Taxa administrativa / pátio"
            defaultValue={
              fieldValue(confirmState, "otherFees") ??
              (parsed.otherFeesCents !== null ? formatMoneyInput(parsed.otherFeesCents) : "")
            }
            error={fieldError(confirmState, "otherFees")}
          />
          <Input
            name="city"
            label="Cidade do pátio"
            defaultValue={fieldValue(confirmState, "city") ?? parsed.city ?? ""}
            error={fieldError(confirmState, "city")}
          />
          <Input
            name="state"
            label="UF"
            maxLength={2}
            className="uppercase"
            defaultValue={fieldValue(confirmState, "state") ?? parsed.state ?? ""}
            error={fieldError(confirmState, "state")}
          />
          <Input
            name="lotUrl"
            label="Link do lote"
            type="url"
            defaultValue={fieldValue(confirmState, "lotUrl") ?? parsed.lotUrl ?? ""}
            error={fieldError(confirmState, "lotUrl")}
          />
        </div>

        <Textarea
          name="notes"
          label="Observações (placa, chassi e Renavam já removidos)"
          rows={3}
          defaultValue={fieldValue(confirmState, "notes") ?? parsed.notes ?? ""}
          error={fieldError(confirmState, "notes")}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={confirmPending} loadingLabel="Criando lote e rascunho…">
            <Download aria-hidden="true" className="size-4" />
            Criar lote e abrir rascunho
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </form>
    </Section>
  );
}
