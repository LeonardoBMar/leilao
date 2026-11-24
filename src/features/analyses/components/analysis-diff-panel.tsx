import { X } from "lucide-react";

import {
  Badge,
  ButtonLink,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { type AnalysisDiffField, type AnalysisDiffSnapshot, diffAnalyses, type DiffValue } from "@/domain/finance/diff";
import { cents } from "@/domain/money";
import { formatBps, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const DIFF_FIELD_LABELS: Record<AnalysisDiffField, string> = {
  marketValue: "Valor de venda esperado",
  fipeValue: "Valor FIPE de referência",
  repairCost: "Reparos",
  documentationCost: "Documentação",
  transportCost: "Transporte / guincho",
  tiresCost: "Pneus",
  serviceCost: "Revisão",
  otherFees: "Outras taxas fixas",
  commission: "Comissão",
  riskReserve: "Reserva para imprevistos",
  desiredMargin: "Margem desejada",
};

function formatDiffValue(value: DiffValue): string {
  switch (value.kind) {
    case "money":
      return value.value === null ? "—" : formatBRL(value.value);
    case "commission":
      if (value.mode === "fixed") return value.fixed === null ? "Fixa (—)" : `${formatBRL(value.fixed)} (fixa)`;
      if (value.mode === "percentage") return value.rate === null ? "Percentual (—)" : `${formatBps(value.rate)} (%)`;
      return "—";
    case "rate_or_money":
      if (value.rate !== null) return `${formatBps(value.rate)} do valor de venda`;
      return value.amount === null ? "—" : formatBRL(value.amount);
  }
}

function isEmptyDiffValue(value: DiffValue): boolean {
  switch (value.kind) {
    case "money":
      return value.value === null;
    case "commission":
      return (
        value.mode === null ||
        (value.mode === "fixed" && value.fixed === null) ||
        (value.mode === "percentage" && value.rate === null)
      );
    case "rate_or_money":
      return value.rate === null && value.amount === null;
  }
}

function formatDelta(deltaCents: number | null, deltaBps: number | null, before: DiffValue, after: DiffValue): string {
  if (deltaCents !== null) {
    if (deltaCents === 0) return "—";
    return `${deltaCents > 0 ? "+ " : "− "}${formatBRL(cents(Math.abs(deltaCents)))}`;
  }
  if (deltaBps !== null) {
    if (deltaBps === 0) return "—";
    return `${deltaBps > 0 ? "+ " : "− "}${formatBps(Math.abs(deltaBps))}`;
  }
  if (isEmptyDiffValue(before) && !isEmptyDiffValue(after)) return "Adicionado";
  if (!isEmptyDiffValue(before) && isEmptyDiffValue(after)) return "Removido";
  return "Modalidade alterada";
}

type AnalysisDiffPanelProps = {
  base: AnalysisDiffSnapshot;
  current: AnalysisDiffSnapshot;
};

/**
 * Comparação estrutural entre duas versões da análise do mesmo lote (D-88).
 * Destaca apenas as premissas alteradas e o impacto líquido no lance máximo.
 */
export function AnalysisDiffPanel({ base, current }: AnalysisDiffPanelProps) {
  const diff = diffAnalyses(base, current);

  return (
    <Card className="grid gap-4 p-4 md:p-5" aria-label={`Comparação entre v${base.version} e v${current.version}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body font-semibold text-foreground">
              Comparação v{base.version} → v{current.version}
            </h3>
            {diff.maxBidDelta !== null && diff.maxBidDelta !== 0 ? (
              <Badge variant={diff.maxBidDelta > 0 ? "success" : "warning"}>
                Lance máximo {diff.maxBidDelta > 0 ? "+ " : "− "}
                {formatBRL(cents(Math.abs(diff.maxBidDelta)))}
              </Badge>
            ) : diff.viabilityChanged ? (
              <Badge variant="warning">Viabilidade alterada</Badge>
            ) : null}
          </div>
          <p className="text-caption text-muted">
            {diff.changes.length === 0
              ? "Nenhuma premissa financeira mudou entre estas versões."
              : diff.changes.length === 1
                ? "1 premissa financeira alterada."
                : `${diff.changes.length} premissas financeiras alteradas.`}
            {diff.notesChanged ? " As observações também foram atualizadas." : ""}
          </p>
        </div>
        <ButtonLink href={`/analise/${current.id}`} variant="ghost" size="sm" aria-label="Fechar comparação de versões">
          <X aria-hidden="true" className="size-4" />
          Fechar
        </ButtonLink>
      </div>

      {diff.changes.length > 0 ? (
        <div className="overflow-x-auto">
          <Table className="min-w-130">
            <TableHeader>
              <TableRow>
                <TableHead>Premissa</TableHead>
                <TableHead className="text-right">v{base.version}</TableHead>
                <TableHead className="text-right">v{current.version}</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diff.changes.map((change) => (
                <TableRow key={change.field}>
                  <TableCell className="font-medium text-foreground">{DIFF_FIELD_LABELS[change.field]}</TableCell>
                  <TableCell className="text-right text-muted tabular-nums">{formatDiffValue(change.before)}</TableCell>
                  <TableCell className="text-right font-medium text-foreground tabular-nums">
                    {formatDiffValue(change.after)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      change.deltaCents === null && change.deltaBps === null && "text-muted",
                    )}
                  >
                    {formatDelta(change.deltaCents, change.deltaBps, change.before, change.after)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {diff.notesChanged ? (
        <details className="rounded-md border border-border bg-background px-3.5 py-2.5 text-caption">
          <summary className="cursor-pointer font-medium text-foreground">Ver alteração nas observações</summary>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-mono text-overline text-muted uppercase">v{base.version}</p>
              <p className="mt-1 whitespace-pre-line text-foreground-secondary">{diff.baseNotes?.trim() || "—"}</p>
            </div>
            <div>
              <p className="font-mono text-overline text-muted uppercase">v{current.version}</p>
              <p className="mt-1 whitespace-pre-line text-foreground">{diff.targetNotes?.trim() || "—"}</p>
            </div>
          </div>
        </details>
      ) : null}
    </Card>
  );
}
