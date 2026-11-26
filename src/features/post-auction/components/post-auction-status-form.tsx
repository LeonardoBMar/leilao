"use client";

import { Save } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, Button, CurrencyInput, Input, SelectField, Textarea, toast } from "@/components/ui";
import { POST_AUCTION_STATUSES, type PostAuctionStatus } from "@/domain/post-auction/pnl";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";
import { toCalendarDateInput } from "@/lib/dates";
import { formatMoneyInput } from "@/lib/format";

import { savePostAuctionAction } from "../actions";
import { POST_AUCTION_STATUS_LABELS } from "../labels";
import type { LotPostAuctionRecord } from "../types";

const STATUS_OPTIONS = POST_AUCTION_STATUSES.map((value) => ({
  value,
  label: POST_AUCTION_STATUS_LABELS[value],
}));

type PostAuctionStatusFormProps = {
  lotId: string;
  record: LotPostAuctionRecord;
};

/** Formulário de etapa, prazos, placa privada e venda realizada do pós-arremate (D-96). */
export function PostAuctionStatusForm({ lotId, record }: PostAuctionStatusFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<PostAuctionStatus>(record.status);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const next = await savePostAuctionAction(lotId, prev, formData);
    if (next.status === "success" && next.message) toast.success(next.message);
    return next;
  }, idleState);

  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);

  const dateValue = (field: string, stored: Date | null) =>
    fieldValue(state, field) ?? (stored ? toCalendarDateInput(stored) : "");

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-5 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-label font-semibold text-foreground">Etapa, prazos e revenda</h3>
        <span className="text-caption text-muted">Dados privados deste lote arrematado</span>
      </div>

      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          name="status"
          label="Etapa atual"
          options={STATUS_OPTIONS}
          value={status}
          onValueChange={(next) => {
            const matched = POST_AUCTION_STATUSES.find((item) => item === next);
            if (matched) setStatus(matched);
          }}
          error={fieldError(state, "status")}
        />
        <Input
          name="privatePlate"
          label="Placa (privada)"
          placeholder="ABC1D23"
          maxLength={10}
          className="font-mono uppercase"
          defaultValue={fieldValue(state, "privatePlate") ?? record.privatePlate ?? ""}
          error={fieldError(state, "privatePlate")}
        />
        <Input
          name="paymentDueAt"
          label="Prazo de pagamento"
          type="date"
          className="tabular-nums"
          defaultValue={dateValue("paymentDueAt", record.paymentDueAt)}
          error={fieldError(state, "paymentDueAt")}
        />
        <Input
          name="paidAt"
          label="Pago em"
          type="date"
          className="tabular-nums"
          defaultValue={dateValue("paidAt", record.paidAt)}
          error={fieldError(state, "paidAt")}
        />
        <Input
          name="pickedUpAt"
          label="Retirado do pátio em"
          type="date"
          className="tabular-nums"
          defaultValue={dateValue("pickedUpAt", record.pickedUpAt)}
          error={fieldError(state, "pickedUpAt")}
        />
        <Input
          name="docReceivedAt"
          label="Documento recebido em"
          type="date"
          className="tabular-nums"
          defaultValue={dateValue("docReceivedAt", record.docReceivedAt)}
          error={fieldError(state, "docReceivedAt")}
        />
        <Input
          name="listedAt"
          label="Anunciado para venda em"
          type="date"
          className="tabular-nums"
          defaultValue={dateValue("listedAt", record.listedAt)}
          error={fieldError(state, "listedAt")}
        />
        <Input
          name="soldAt"
          label="Vendido em"
          type="date"
          required={status === "sold"}
          className="tabular-nums"
          defaultValue={dateValue("soldAt", record.soldAt)}
          error={fieldError(state, "soldAt")}
        />
        <CurrencyInput
          name="salePrice"
          label="Preço real de venda"
          required={status === "sold"}
          defaultValue={
            fieldValue(state, "salePrice") ?? (record.salePrice !== null ? formatMoneyInput(record.salePrice) : "")
          }
          error={fieldError(state, "salePrice")}
        />
      </div>

      <Textarea
        name="notes"
        label="Observações de oficina, documentação e venda"
        rows={3}
        maxLength={5_000}
        defaultValue={fieldValue(state, "notes") ?? record.notes ?? ""}
        error={fieldError(state, "notes")}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={pending} loadingLabel="Salvando…">
          <Save aria-hidden="true" />
          Salvar pós-arremate
        </Button>
      </div>
    </form>
  );
}
