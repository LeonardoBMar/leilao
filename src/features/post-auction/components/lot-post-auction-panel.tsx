import { AlertTriangle, Briefcase } from "lucide-react";
import Link from "next/link";

import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  Money,
  Section,
  SectionHeader,
  SectionTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { type Cents, cents } from "@/domain/money";
import { toZonedDateInput } from "@/lib/dates";
import { formatBRL, formatCalendarDate, formatDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

import { EXPENSE_CATEGORY_LABELS, POST_AUCTION_STATUS_LABELS, POST_AUCTION_STATUS_VARIANTS } from "../labels";
import { getLotPostAuctionContext } from "../queries";
import { PostAuctionExpenses } from "./post-auction-expenses";
import { PostAuctionStatusForm } from "./post-auction-status-form";

/**
 * Painel pós-arremate da ficha do lote (D-96). Só renderiza quando o usuário registrou `personalOutcome = "won"`.
 * Exibe P&L realizado, desvio por categoria frente à análise fixada, despesas reais e controle de etapa/venda.
 */
export async function LotPostAuctionPanel({ lotId }: { lotId: string }) {
  const context = await getLotPostAuctionContext(lotId);
  if (!context) return null;

  const { record, expenses, pnl, analysisId, analysisVersion, isPaymentOverdue } = context;
  const defaultDate = toZonedDateInput(new Date());

  return (
    <Section className="grid gap-5 border-t border-border pt-7">
      <SectionHeader>
        <div className="flex flex-wrap items-center gap-2.5">
          <SectionTitle className="flex items-center gap-2">
            <Briefcase aria-hidden="true" className="size-4 shrink-0 text-muted" />
            Pós-arremate
          </SectionTitle>
          <Badge variant={POST_AUCTION_STATUS_VARIANTS[record.status]}>
            {POST_AUCTION_STATUS_LABELS[record.status]}
          </Badge>
        </div>
        {analysisId && analysisVersion !== null ? (
          <Link href={`/analise/${analysisId}`} className="text-caption font-medium text-accent hover:underline">
            Base prevista: análise v{analysisVersion}
          </Link>
        ) : null}
      </SectionHeader>

      {isPaymentOverdue && record.paymentDueAt ? (
        <Alert variant="error">
          <AlertDescription className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            <span>
              Prazo de pagamento venceu em {formatCalendarDate(record.paymentDueAt)} sem data de pagamento registrada.
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="metric" className="grid gap-1 p-3.5">
          <p className="text-caption text-muted">Total investido</p>
          <p className="text-heading-3 font-semibold text-foreground tabular-nums">
            <Money value={pnl.totalInvested} />
          </p>
          <p className="text-caption text-muted tabular-nums">
            Lance <Money value={pnl.finalBid} /> + despesas <Money value={pnl.totalExpenses} />
          </p>
        </Card>

        <Card variant="metric" className="grid gap-1 p-3.5">
          <p className="text-caption text-muted">Custo real vs. previsto</p>
          <p
            className={cn(
              "text-heading-3 font-semibold tabular-nums",
              pnl.costVariance === null
                ? "text-muted"
                : pnl.costVariance > 0
                  ? "text-error"
                  : pnl.costVariance < 0
                    ? "text-success"
                    : "text-foreground",
            )}
          >
            {pnl.costVariance === null
              ? "Sem base"
              : pnl.costVariance === 0
                ? "No previsto"
                : `${pnl.costVariance > 0 ? "+ " : "− "}${formatBRL(cents(Math.abs(pnl.costVariance)))}`}
          </p>
          <p className="text-caption text-muted tabular-nums">
            {pnl.plannedTotalWithoutReserve !== null ? (
              <>
                Previsto <Money value={pnl.plannedTotalWithoutReserve} /> (sem reserva)
              </>
            ) : (
              "Vincule uma análise fixada no resultado"
            )}
          </p>
        </Card>

        <Card variant="metric" className="grid gap-1 p-3.5">
          <p className="text-caption text-muted">
            {pnl.realizedProfit !== null ? "Lucro líquido realizado" : "Lucro esperado no lance"}
          </p>
          <p
            className={cn(
              "text-heading-3 font-semibold tabular-nums",
              (pnl.realizedProfit ?? pnl.expectedProfitAtBid ?? 0) > 0 && "text-success",
              (pnl.realizedProfit ?? pnl.expectedProfitAtBid ?? 0) < 0 && "text-error",
              pnl.realizedProfit === null && pnl.expectedProfitAtBid === null && "text-muted",
            )}
          >
            {pnl.realizedProfit !== null ? (
              <SignedMoney value={pnl.realizedProfit} />
            ) : pnl.expectedProfitAtBid !== null ? (
              <SignedMoney value={pnl.expectedProfitAtBid} />
            ) : (
              "—"
            )}
          </p>
          <p className="text-caption text-muted tabular-nums">
            {pnl.realizedMarginRatio !== null
              ? `Margem real ${formatDecimal(pnl.realizedMarginRatio * 100)}%`
              : record.status !== "sold" || record.salePrice === null
                ? "Registre a venda para apurar"
                : "—"}
          </p>
        </Card>

        <Card variant="metric" className="grid gap-1 p-3.5">
          <p className="text-caption text-muted">ROI e giro</p>
          <p
            className={cn(
              "text-heading-3 font-semibold tabular-nums",
              pnl.realizedRoiRatio === null
                ? "text-foreground"
                : pnl.realizedRoiRatio > 0
                  ? "text-success"
                  : pnl.realizedRoiRatio < 0
                    ? "text-error"
                    : "text-foreground",
            )}
          >
            {pnl.realizedRoiRatio !== null
              ? `${formatDecimal(pnl.realizedRoiRatio * 100)}%`
              : pnl.holdDays !== null
                ? `${pnl.holdDays} dias`
                : "—"}
          </p>
          <p className="text-caption text-muted tabular-nums">
            {pnl.monthlyRoiRatio !== null && pnl.holdDays !== null
              ? `${formatDecimal(pnl.monthlyRoiRatio * 100)}%/mês · ${pnl.holdDays} dias`
              : pnl.holdDays !== null
                ? `${pnl.holdDays} dias em carteira`
                : "Sem data de arremate"}
          </p>
        </Card>
      </div>

      {pnl.byCategory.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-label font-semibold text-foreground">Previsto × realizado por categoria</h3>
          <div className="overflow-x-auto">
            <Table className="min-w-130">
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pnl.byCategory.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="text-foreground">{EXPENSE_CATEGORY_LABELS[row.category]}</TableCell>
                    <TableCell className="text-right text-muted tabular-nums">
                      {row.planned === null ? "—" : <Money value={row.planned} />}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground tabular-nums">
                      <Money value={row.actual} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        row.variance === null
                          ? "text-muted"
                          : row.variance > 0
                            ? "text-error"
                            : row.variance < 0
                              ? "text-success"
                              : "text-muted",
                      )}
                    >
                      {row.variance === null ? (
                        "—"
                      ) : row.variance === 0 ? (
                        "R$ 0,00"
                      ) : (
                        <>
                          {row.variance > 0 ? "+ " : "− "}
                          {formatBRL(cents(Math.abs(row.variance)))}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <PostAuctionExpenses lotId={lotId} expenses={expenses} defaultDate={defaultDate} />
      <PostAuctionStatusForm key={record.updatedAt?.toISOString() ?? "initial"} lotId={lotId} record={record} />
    </Section>
  );
}

function SignedMoney({ value }: { value: Cents }) {
  return <>{value < 0 ? `− ${formatBRL(cents(Math.abs(value)))}` : formatBRL(value)}</>;
}
