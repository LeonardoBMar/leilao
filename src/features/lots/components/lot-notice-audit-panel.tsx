"use client";

import { ArrowUpRight, FileSearch, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ConfirmDialog,
  Section,
  SectionHeader,
  SectionTitle,
  Textarea,
  toast,
  useActionToast,
} from "@/components/ui";
import type { NoticeFindingCategory, NoticeFindingSeverity } from "@/domain/lots/notice-audit";
import { type ActionState, fieldValue, idleState } from "@/lib/action-state";
import { formatBps, formatBRL, formatDateTime } from "@/lib/format";

import { applyNoticeFeesToDraftAction, auditLotNoticeAction, clearLotNoticeAuditAction } from "../actions";
import type { StoredNoticeAudit } from "../types";

const SEVERITY_LABELS: Record<NoticeFindingSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Info",
};

const SEVERITY_VARIANTS = {
  critical: "destructive",
  warning: "warning",
  info: "default",
} as const satisfies Record<NoticeFindingSeverity, "destructive" | "warning" | "default">;

const CATEGORY_LABELS: Record<NoticeFindingCategory, string> = {
  debts: "Débitos",
  fees: "Taxas",
  deadlines: "Prazos",
  condition: "Condição",
};

type LotNoticeAuditPanelProps = {
  lotId: string;
  audit: StoredNoticeAudit | null;
};

/** Auditoria determinística de edital (texto colado ou PDF/TXT) na ficha do lote (D-97). */
export function LotNoticeAuditPanel({ lotId, audit }: LotNoticeAuditPanelProps) {
  const [formKey, setFormKey] = useState(0);
  const { isPending: isClearing, run: runClear } = useActionToast();
  const { isPending: isApplying, run: runApply } = useActionToast();

  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const next = await auditLotNoticeAction(lotId, prev, formData);
    if (next.status === "success") {
      if (next.message) toast.success(next.message);
      setFormKey((key) => key + 1);
    }
    return next;
  }, idleState);

  const fees = audit?.result.extractedFees;
  const hasApplicableFees =
    fees !== undefined &&
    (fees.commissionRateBps !== null || fees.adminFeesCents !== null || fees.debtsCapCents !== null);

  return (
    <Section id="edital" className="grid gap-4 border-t border-border pt-7">
      <SectionHeader>
        <div className="flex flex-wrap items-center gap-2.5">
          <SectionTitle className="flex items-center gap-2">
            <FileSearch aria-hidden="true" className="size-4 shrink-0 text-muted" />
            Auditoria de edital
          </SectionTitle>
          {audit ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {audit.result.counts.critical > 0 ? (
                <Badge variant="destructive" className="tabular-nums">
                  {audit.result.counts.critical} {audit.result.counts.critical === 1 ? "crítico" : "críticos"}
                </Badge>
              ) : null}
              {audit.result.counts.warning > 0 ? (
                <Badge variant="warning" className="tabular-nums">
                  {audit.result.counts.warning} {audit.result.counts.warning === 1 ? "atenção" : "atenções"}
                </Badge>
              ) : null}
              {audit.result.counts.info > 0 ? (
                <Badge variant="outline" className="tabular-nums">
                  {audit.result.counts.info} info
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        {audit ? (
          <ConfirmDialog
            title="Remover auditoria salva?"
            description="O resumo e os trechos citados deste edital serão apagados do lote."
            confirmLabel="Remover"
            loading={isClearing}
            loadingLabel="Removendo…"
            closeOnConfirm
            onConfirm={() => runClear(() => clearLotNoticeAuditAction(lotId))}
            trigger={
              <Button type="button" variant="ghost" size="sm" className="text-muted hover:text-error">
                <Trash2 aria-hidden="true" className="size-4" />
                Limpar
              </Button>
            }
          />
        ) : null}
      </SectionHeader>

      <form
        key={formKey}
        action={formAction}
        noValidate
        className="grid gap-3 rounded-lg border border-border bg-background p-4"
      >
        {state.status === "error" ? (
          <Alert variant="error">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Textarea
          name="noticeText"
          label="Cole o texto do edital ou das condições de venda"
          placeholder="Ex.: Comissão do leiloeiro de 5%, taxa administrativa R$ 1.850,00, débitos de IPVA por conta do arrematante, pagamento em 24 horas…"
          rows={4}
          defaultValue={fieldValue(state, "noticeText") ?? ""}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="grid gap-1 text-caption text-muted">
            <span>Ou envie o arquivo do edital (PDF ou TXT, até 4 MB)</span>
            <input
              type="file"
              name="noticeFile"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="text-caption text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1 file:text-caption file:font-medium file:text-foreground hover:file:bg-surface-subtle"
            />
          </label>
          <Button type="submit" variant="secondary" size="sm" loading={pending} loadingLabel="Auditando…">
            <FileSearch aria-hidden="true" className="size-4" />
            Auditar edital
          </Button>
        </div>
      </form>

      {audit ? (
        <div className="grid gap-4">
          <p className="text-caption text-muted">
            Origem: <strong className="font-medium text-foreground">{audit.sourceLabel}</strong> · Auditado em{" "}
            {formatDateTime(new Date(audit.auditedAt))} (motor determinístico, com citação literal).
          </p>

          {hasApplicableFees && fees ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info-border bg-info-subtle/40 px-4 py-3">
              <div className="grid gap-0.5 text-caption">
                <p className="font-semibold text-foreground">Taxas identificadas no edital</p>
                <p className="text-foreground-secondary tabular-nums">
                  {[
                    fees.commissionRateBps !== null ? `Comissão ${formatBps(fees.commissionRateBps)}` : null,
                    fees.adminFeesCents !== null ? `Taxa adm. ${formatBRL(fees.adminFeesCents)}` : null,
                    fees.debtsCapCents !== null ? `Teto débitos ${formatBRL(fees.debtsCapCents)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                loading={isApplying}
                loadingLabel="Aplicando…"
                onClick={() => runApply(() => applyNoticeFeesToDraftAction(lotId))}
              >
                Levar taxas para o rascunho
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : null}

          {audit.result.findings.length === 0 ? (
            <p className="rounded-md border border-border bg-surface p-4 text-body text-muted">
              Nenhuma cláusula crítica padrão foi identificada neste trecho. Leia o edital completo antes de fixar o
              lance.
            </p>
          ) : (
            <ul className="grid gap-2.5">
              {audit.result.findings.map((finding) => (
                <li key={finding.id} className="grid gap-2 rounded-lg border border-border bg-surface p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SEVERITY_VARIANTS[finding.severity]}>{SEVERITY_LABELS[finding.severity]}</Badge>
                    <Badge variant="outline">{CATEGORY_LABELS[finding.category]}</Badge>
                    <span className="text-label font-semibold text-foreground">{finding.title}</span>
                  </div>
                  <p className="text-body text-foreground-secondary">{finding.summary}</p>
                  <blockquote className="border-l-2 border-border-strong pl-3 font-mono text-caption text-muted">
                    “{finding.excerpt}”
                  </blockquote>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Section>
  );
}
