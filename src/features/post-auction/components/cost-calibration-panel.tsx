import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import {
  Alert,
  AlertDescription,
  Badge,
  ButtonLink,
  Card,
  Money,
  Section,
  SectionHeader,
  SectionTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { type Cents, cents } from "@/domain/money";
import { type CostCalibrationSummary, MIN_COST_CALIBRATION_LOTS } from "@/domain/research/cost-calibration";
import { formatBRL, formatDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

import { EXPENSE_CATEGORY_LABELS } from "../labels";

type CostCalibrationPanelProps = {
  summary: CostCalibrationSummary;
  /** Botão de confirmação para aplicar ajustes em `user_preferences`, composto na rota. */
  applyControl?: ReactNode;
};

/**
 * Calibração 2.0 (D-97): compara custos reais e preço real de venda dos lotes vendidos no pós-arremate
 * com as análises fixadas antes do leilão (`analysisTiming = "prior"`).
 */
export function CostCalibrationPanel({ summary, applyControl }: CostCalibrationPanelProps) {
  return (
    <Section aria-labelledby="calibracao-custos" className="grid gap-4 border-t border-border pt-6">
      <SectionHeader>
        <div className="grid gap-1">
          <SectionTitle id="calibracao-custos">Calibração de custos e revenda</SectionTitle>
          <p className="text-body text-muted">
            Cruza veículos vendidos no pós-arremate com análises fixadas antes do leilão para medir o erro real de
            orçamento e revenda.
          </p>
        </div>
        {summary.n > 0 ? (
          <Badge variant="outline" className="tabular-nums">
            {summary.n === 1 ? "1 venda calibrada" : `${summary.n} vendas calibradas`}
          </Badge>
        ) : null}
      </SectionHeader>

      {summary.n === 0 ? (
        <Card className="grid gap-3 p-5">
          <p className="text-body text-foreground">Nenhuma venda encerrada com análise pré-leilão vinculada ainda.</p>
          <p className="text-body text-muted">
            Ao arrematar um lote, lance suas despesas reais e o preço final de venda no painel de{" "}
            <strong>Pós-arremate</strong> da ficha do lote. Quando marcar a etapa como <strong>Vendido</strong>, o viés
            por categoria e os ajustes sugeridos aparecem aqui.
          </p>
          <div>
            <ButtonLink href="/minhas-analises?vista=carteira" variant="secondary" size="sm">
              Abrir Carteira
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5">
          {!summary.hasMinimumSample ? (
            <Alert variant="info">
              <AlertDescription className="tabular-nums">
                Amostra inicial ({summary.n} de {MIN_COST_CALIBRATION_LOTS} vendas): acompanhe os desvios abaixo; as
                sugestões de ajuste automático nas preferências entram a partir de {MIN_COST_CALIBRATION_LOTS} vendas.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <Card variant="metric" className="grid gap-1 p-4">
              <p className="text-caption text-muted">Preço real de venda vs. esperado</p>
              <p
                className={cn(
                  "text-heading-3 font-semibold tabular-nums",
                  summary.salePriceBias.medianBiasRatio === null
                    ? "text-muted"
                    : summary.salePriceBias.medianBiasRatio < -0.02
                      ? "text-error"
                      : summary.salePriceBias.medianBiasRatio > 0.02
                        ? "text-success"
                        : "text-foreground",
                )}
              >
                {summary.salePriceBias.medianBiasRatio === null
                  ? "—"
                  : formatSignedPercent(summary.salePriceBias.medianBiasRatio)}
              </p>
              <p className="text-caption text-muted tabular-nums">
                {summary.salePriceBias.medianActual !== null && summary.salePriceBias.medianExpected !== null ? (
                  <>
                    Mediana real <Money value={summary.salePriceBias.medianActual} /> vs.{" "}
                    <Money value={summary.salePriceBias.medianExpected} />
                  </>
                ) : (
                  "Sem vendas com preço esperado"
                )}
              </p>
            </Card>

            <Card variant="metric" className="grid gap-1 p-4">
              <p className="text-caption text-muted">Custo total real vs. previsto</p>
              <p
                className={cn(
                  "text-heading-3 font-semibold tabular-nums",
                  summary.medianCostVarianceRatio === null
                    ? "text-muted"
                    : summary.medianCostVarianceRatio > 0.03
                      ? "text-error"
                      : summary.medianCostVarianceRatio < -0.02
                        ? "text-success"
                        : "text-foreground",
                )}
              >
                {summary.medianCostVarianceRatio === null ? "—" : formatSignedPercent(summary.medianCostVarianceRatio)}
              </p>
              <p className="text-caption text-muted tabular-nums">
                {summary.medianHoldDays !== null
                  ? `Giro mediano: ${summary.medianHoldDays} dias`
                  : "Comparado ao previsto sem reserva"}
              </p>
            </Card>

            <Card variant="metric" className="grid gap-1 p-4">
              <p className="text-caption text-muted">Lucro realizado acumulado</p>
              <p
                className={cn(
                  "text-heading-3 font-semibold tabular-nums",
                  summary.totalRealizedProfit > 0 && "text-success",
                  summary.totalRealizedProfit < 0 && "text-error",
                )}
              >
                <SignedMoney value={summary.totalRealizedProfit} />
              </p>
              <p className="text-caption text-muted tabular-nums">
                Esperado no lance: <SignedMoney value={summary.totalExpectedProfit} />
              </p>
            </Card>
          </div>

          {summary.byCategory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-130">
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria de custo</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Mediana prevista</TableHead>
                    <TableHead className="text-right">Mediana real</TableHead>
                    <TableHead className="text-right">Desvio mediano</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.byCategory.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="text-foreground">{EXPENSE_CATEGORY_LABELS[row.category]}</TableCell>
                      <TableCell className="text-right text-muted tabular-nums">{row.sampleCount}</TableCell>
                      <TableCell className="text-right text-muted tabular-nums">
                        <Money value={row.medianPlanned} />
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground tabular-nums">
                        <Money value={row.medianActual} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          row.medianDelta > 0 ? "text-error" : row.medianDelta < 0 ? "text-success" : "text-muted",
                        )}
                      >
                        <SignedMoney value={row.medianDelta} />
                        {row.medianBiasRatio !== null ? (
                          <span className="ml-1.5 text-caption">({formatSignedPercent(row.medianBiasRatio)})</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {summary.suggestions.length > 0 ? (
            <Card className="grid gap-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-0.5">
                  <h3 className="text-label font-semibold text-foreground">Ajustes sugeridos nas preferências</h3>
                  <p className="text-caption text-muted">
                    Baseados na mediana das suas vendas reais; aplicados somente mediante confirmação.
                  </p>
                </div>
                {applyControl}
              </div>
              <ul className="grid gap-2 text-body">
                {summary.suggestions.map((suggestion) => (
                  <li key={suggestion.id} className="rounded-md border border-border bg-background px-3.5 py-2.5">
                    <p className="font-medium text-foreground">{suggestion.title}</p>
                    <p className="text-caption text-muted">{suggestion.rationale}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </Section>
  );
}

export function CostCalibrationPanelSkeleton() {
  return (
    <div className="grid gap-4 border-t border-border pt-6" aria-hidden="true">
      <Skeleton className="h-7 w-64" />
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}

function formatSignedPercent(ratio: number): string {
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${formatDecimal(Math.abs(pct))}%`;
}

function SignedMoney({ value }: { value: Cents }) {
  return (
    <>{value > 0 ? `+ ${formatBRL(value)}` : value < 0 ? `− ${formatBRL(cents(Math.abs(value)))}` : formatBRL(value)}</>
  );
}
