import { Target } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ScatterPlot } from "@/components/charts/scatter-plot";
import {
  Card,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { cents } from "@/domain/money";
import {
  bandPlacement,
  calibrationByCategory,
  EXPECTED_BAND_HIT_RATE,
  limitDeviation,
  MIN_CALIBRATION_RESULTS,
  summarizeCalibration,
} from "@/domain/research/calibration";
import { getCalibration } from "@/features/analyses/queries";
import type { CalibrationItem } from "@/features/analyses/types";
import { niceRange } from "@/lib/charts";
import { formatBRL, formatCalendarDate, formatCompactBRL, formatRatio } from "@/lib/format";

import { BAND_PLACEMENT_LABELS, bandHitSentence, deviationLabel, limitSentence, listingCategoryLabel } from "../labels";
import { ResearchBlock } from "./research-block";

/**
 * Calibração (docs/PLANO-MERCADO.md §7): como as análises fixadas antes do desfecho se saíram frente ao arremate. As
 * frases do topo, o gráfico limite × arremate com a diagonal, a quebra por categoria e a tabela por análise. A faixa da
 * época nunca usa vendas posteriores à fixação (`getCalibration`). Com menos de `MIN_CALIBRATION_RESULTS`, avisa que os
 * números ainda mudam muito.
 */
export async function CalibrationView() {
  const items = await getCalibration();
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="Nenhum resultado para calibrar ainda"
        description="A Calibração compara o limite das análises fixadas antes do leilão com o arremate. Fixe a análise de um lote antes do fim e registre o resultado: ele aparece aqui."
      />
    );
  }
  const summary = summarizeCalibration(items);
  const categories = calibrationByCategory(items);
  const hit = bandHitSentence(summary);
  const limit = limitSentence(summary);

  return (
    <div className="grid gap-6">
      {items.length < MIN_CALIBRATION_RESULTS ? (
        <p className="rounded-md border border-border bg-surface-subtle px-4 py-3 text-body text-muted">
          Poucos resultados ({items.length} de {MIN_CALIBRATION_RESULTS}): os números abaixo ainda mudam muito a cada
          lote.
        </p>
      ) : null}
      <section aria-label="Resumo" className="grid gap-3 md:grid-cols-2">
        {hit === null ? (
          <Statement title="Nenhum resultado com a faixa da época">
            Na fixação desses lotes, o modelo ainda não tinha vendas comparáveis encerradas o bastante para uma faixa
            típica.
          </Statement>
        ) : (
          <Statement title={hit}>
            O esperado é cerca de {formatRatio(EXPECTED_BAND_HIT_RATE)}: a faixa típica é a metade do meio das vendas
            comparáveis. Bem menos que isso indica comparáveis ruins para os seus lotes.
          </Statement>
        )}
        {limit === null ? null : (
          <Statement title={limit}>
            Com o limite fixado, você alcançaria {summary.limit.reached} de {summary.limit.n}{" "}
            {summary.limit.n === 1 ? "lote" : "lotes"}.
            {summary.limit.n < summary.n
              ? ` ${summary.n - summary.limit.n} sem lance viável na análise ficam fora desta conta.`
              : ""}
          </Statement>
        )}
      </section>

      <LimitChart items={items} />

      {categories.length > 1 ? (
        <ResearchBlock id="calibracao-categoria" title="Por categoria">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Resultados</TableHead>
                <TableHead className="text-right">Dentro da faixa</TableHead>
                <TableHead className="text-right">Limite na mediana</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(({ category, summary: group }) => (
                <TableRow key={category ?? "sem-anuncio"}>
                  <TableCell>{listingCategoryLabel(category)}</TableCell>
                  <TableCell className="text-right tabular-nums">{group.n}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {group.band.rate === null ? "—" : `${group.band.inside} de ${group.band.n}`}
                  </TableCell>
                  <TableCell className="text-right">
                    {group.limit.medianDeviation === null ? "—" : deviationLabel(group.limit.medianDeviation)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResearchBlock>
      ) : null}

      <ResearchBlock
        id="calibracao-analises"
        title="Por análise"
        description="A faixa é a da época da fixação, só com vendas encerradas antes dela."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Fixada em</TableHead>
              <TableHead className="text-right">Faixa da época</TableHead>
              <TableHead className="text-right">Limite</TableHead>
              <TableHead className="text-right">Arremate</TableHead>
              <TableHead>Posição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.analysisId}>
                <TableCell className="max-w-64">
                  <Link href={`/lotes/${item.lotId}`} className="text-accent hover:text-accent-hover hover:underline">
                    {item.label}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">
                  <Link href={`/analise/${item.analysisId}`} className="hover:text-foreground hover:underline">
                    {formatCalendarDate(item.fixedAt)}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.band === null
                    ? "—"
                    : `${formatCompactBRL(item.band.low)} a ${formatCompactBRL(item.band.high)}`}
                  {item.band !== null && item.bandSource === "recomputed" ? (
                    <span className="block text-caption text-muted">recalculada</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.limit === null ? <span className="text-muted">sem lance viável</span> : formatBRL(item.limit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(item.finalBid)}</TableCell>
                <TableCell>
                  <span className="block">
                    {item.band === null ? "Sem faixa" : BAND_PLACEMENT_LABELS[bandPlacement(item.finalBid, item.band)]}
                  </span>
                  {item.limit === null ? null : (
                    <span className="block text-caption text-muted">
                      Limite {deviationLabel(limitDeviation(item.limit, item.finalBid))}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResearchBlock>
    </div>
  );
}

function Statement({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card variant="metric" className="grid content-start gap-2 p-4">
      <p className="text-heading-3 text-foreground">{title}</p>
      <p className="text-body text-muted">{children}</p>
    </Card>
  );
}

/** Limite fixado × arremate, com a diagonal: ponto acima dela é arremate acima do limite. Sem lance viável fica fora. */
function LimitChart({ items }: { items: readonly CalibrationItem[] }) {
  const points = items.flatMap((item) => (item.limit === null ? [] : [{ item, limit: item.limit }]));
  if (points.length === 0) return null;
  // Os dois eixos na mesma escala, para a diagonal ser a linha "limite = arremate".
  const values = points.flatMap(({ item, limit }) => [limit, item.finalBid]);
  const { domain, ticks } = niceRange(Math.min(...values), Math.max(...values));
  const labelled = ticks.map((value) => ({ value, label: formatCompactBRL(cents(Math.round(value))) }));
  const above = points.filter(({ item, limit }) => item.finalBid > limit).length;

  return (
    <ResearchBlock
      id="calibracao-grafico"
      title="Limite × arremate"
      description={`Cada ponto é um lote: o limite fixado no eixo de baixo, o arremate no lateral. Acima da diagonal, o arremate passou do limite (${above} de ${points.length}).`}
    >
      <ScatterPlot
        ariaLabel={`Limite fixado × arremate: ${points
          .map(({ item, limit }) => `${item.label}, limite ${formatBRL(limit)}, arremate ${formatBRL(item.finalBid)}`)
          .join("; ")}`}
        xAxis={{ domain, ticks: labelled }}
        yDomain={domain}
        yTicks={labelled}
        diagonal={{ label: "limite = arremate" }}
        points={points.map(({ item, limit }) => ({
          key: item.analysisId,
          x: limit,
          y: item.finalBid,
          title: `${item.label}: limite ${formatBRL(limit)}, arremate ${formatBRL(item.finalBid)}`,
        }))}
      />
    </ResearchBlock>
  );
}

export function CalibrationViewSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}
