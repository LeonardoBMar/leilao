import { AlertTriangle, Briefcase } from "lucide-react";
import Link from "next/link";

import {
  Alert,
  AlertDescription,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Money,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { cents } from "@/domain/money";
import { formatBRL, formatCalendarDate, formatDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

import { POST_AUCTION_STATUS_LABELS, POST_AUCTION_STATUS_VARIANTS } from "../labels";
import { getPortfolioOverview } from "../queries";

/**
 * Visão consolidada da carteira de veículos arrematados pelo usuário (aba Carteira em Minhas análises, D-96).
 */
export async function PortfolioView() {
  const { summary, items } = await getPortfolioOverview();

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Nenhum veículo na carteira ainda"
        description="Quando você registrar um resultado marcando “Arrematei”, o lote aparece aqui com controle de despesas reais, etapas pós-arremate, lucro líquido e tempo de giro."
        action={
          <ButtonLink href="/minhas-analises" variant="secondary">
            Ver todos os lotes
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      {summary.overduePaymentCount > 0 ? (
        <Alert variant="error">
          <AlertDescription className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            <span>
              {summary.overduePaymentCount === 1
                ? "1 lote arrematado está com prazo de pagamento vencido."
                : `${summary.overduePaymentCount} lotes arrematados estão com prazo de pagamento vencido.`}
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="metric" className="grid gap-1 p-4">
          <p className="text-caption text-muted">Capital imobilizado</p>
          <p className="text-heading-2 font-semibold text-foreground tabular-nums">
            <Money value={summary.capitalDeployed} />
          </p>
          <p className="text-caption text-muted tabular-nums">
            {summary.inProgressCount === 1
              ? "1 veículo em operação"
              : `${summary.inProgressCount} veículos em operação`}
          </p>
        </Card>

        <Card variant="metric" className="grid gap-1 p-4">
          <p className="text-caption text-muted">Lucro realizado acumulado</p>
          <p
            className={cn(
              "text-heading-2 font-semibold tabular-nums",
              summary.soldCount === 0
                ? "text-muted"
                : summary.totalRealizedProfit > 0
                  ? "text-success"
                  : summary.totalRealizedProfit < 0
                    ? "text-error"
                    : "text-foreground",
            )}
          >
            {summary.soldCount === 0 ? (
              "—"
            ) : summary.totalRealizedProfit < 0 ? (
              `− ${formatBRL(cents(Math.abs(summary.totalRealizedProfit)))}`
            ) : (
              <Money value={summary.totalRealizedProfit} />
            )}
          </p>
          <p className="text-caption text-muted tabular-nums">
            {summary.soldCount === 0
              ? "Nenhum veículo vendido ainda"
              : summary.soldCount === 1
                ? "1 veículo vendido"
                : `${summary.soldCount} veículos vendidos`}
          </p>
        </Card>

        <Card variant="metric" className="grid gap-1 p-4">
          <p className="text-caption text-muted">ROI médio realizado</p>
          <p
            className={cn(
              "text-heading-2 font-semibold tabular-nums",
              summary.averageRoiRatio === null
                ? "text-muted"
                : summary.averageRoiRatio > 0
                  ? "text-success"
                  : summary.averageRoiRatio < 0
                    ? "text-error"
                    : "text-foreground",
            )}
          >
            {summary.averageRoiRatio === null ? "—" : `${formatDecimal(summary.averageRoiRatio * 100)}%`}
          </p>
          <p className="text-caption text-muted tabular-nums">
            {summary.totalSoldInvested > 0 ? (
              <>
                Sobre <Money value={summary.totalSoldInvested} /> investidos
              </>
            ) : (
              "Ponderado pelos veículos vendidos"
            )}
          </p>
        </Card>

        <Card variant="metric" className="grid gap-1 p-4">
          <p className="text-caption text-muted">Giro mediano</p>
          <p className="text-heading-2 font-semibold text-foreground tabular-nums">
            {summary.medianHoldDays === null ? "—" : `${summary.medianHoldDays} dias`}
          </p>
          <p className="text-caption text-muted">Do arremate até a venda</p>
        </Card>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-170">
          <TableHeader>
            <TableRow>
              <TableHead>Veículo</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">Investido</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Lucro / ROI</TableHead>
              <TableHead className="text-right">Giro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.lotId}>
                <TableCell>
                  <div className="grid gap-0.5">
                    <Link href={`/lotes/${item.lotId}`} className="font-medium text-accent hover:underline">
                      {item.title}
                    </Link>
                    <span className="text-caption text-muted">
                      Lote {item.lotNumber} · {item.auctionName}
                    </span>
                    {item.isPaymentOverdue && item.paymentDueAt ? (
                      <span className="text-caption font-medium text-error">
                        Pagamento vencido em {formatCalendarDate(item.paymentDueAt)}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={POST_AUCTION_STATUS_VARIANTS[item.status]}>
                    {POST_AUCTION_STATUS_LABELS[item.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div className="grid gap-0.5">
                    <span className="font-medium text-foreground">
                      <Money value={item.totalInvested} />
                    </span>
                    <span className="text-caption text-muted">
                      Desp. <Money value={item.totalExpenses} />
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.salePrice === null ? <span className="text-muted">—</span> : <Money value={item.salePrice} />}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.realizedProfit === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <div className="grid gap-0.5">
                      <span
                        className={cn(
                          "font-medium",
                          item.realizedProfit > 0 && "text-success",
                          item.realizedProfit < 0 && "text-error",
                        )}
                      >
                        {item.realizedProfit < 0
                          ? `− ${formatBRL(cents(Math.abs(item.realizedProfit)))}`
                          : formatBRL(item.realizedProfit)}
                      </span>
                      {item.realizedRoiRatio !== null ? (
                        <span className="text-caption text-muted">{formatDecimal(item.realizedRoiRatio * 100)}%</span>
                      ) : null}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted tabular-nums">
                  {item.holdDays === null ? "—" : `${item.holdDays} d`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function PortfolioViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
