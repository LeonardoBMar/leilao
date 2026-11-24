import "server-only";

import { cache } from "react";
import { z } from "zod";

import { VEHICLE_ORIGINS } from "@/domain/listings/origin";
import {
  comparisonGroups,
  DAMAGE_OF_CONDITION,
  groupLabel,
  RESEARCH_CONDITIONS,
  type ResearchFilters,
} from "@/domain/research/filters";
import {
  fillHistogram,
  HISTOGRAM_STEP,
  ratioAxisMax,
  summarize,
  unclassifiedLooksMixed,
  weeklyTrend,
} from "@/domain/research/summary";
import { type Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";

import type {
  ComparisonView,
  ConditionDistribution,
  OriginDistribution,
  RatioDistribution,
  WeeklyTrend,
} from "../types";
import { ratioDistribution } from "./shared";
import { levelSchema, RATIO, rows, salesWhere, sql, statsColumns, statsShape, toStats } from "./sql";

/**
 * Resumo e histograma do % da FIPE de cada grupo de um recorte, num eixo comum (o fim vem da maior proporção). `group`
 * é a expressão SQL do grupo, validada por `key`; grupo sem venda volta como `summarize(undefined)` e histograma vazio.
 */
async function groupedDistribution<K extends string>(
  key: z.ZodType<K>,
  group: Prisma.Sql,
  where: Prisma.Sql,
): Promise<{ axisMax: number; of: (value: K) => RatioDistribution }> {
  const [statsRows, binRows] = await Promise.all([
    rows(
      z.object({ key, ...statsShape, max: z.number() }),
      sql`SELECT ${group} AS key, ${statsColumns(RATIO)}, max(${RATIO}) AS max FROM listings l WHERE ${where} GROUP BY 1`,
    ),
    rows(
      z.object({ key, bin: z.number().int(), n: z.number().int() }),
      sql`SELECT ${group} AS key, floor(${RATIO} / ${HISTOGRAM_STEP}::float8 + 1e-9)::int AS bin, count(*)::int AS n
        FROM listings l WHERE ${where} GROUP BY 1, 2`,
    ),
  ]);
  const axisMax = ratioAxisMax(statsRows.length === 0 ? null : Math.max(...statsRows.map((row) => row.max)));
  return {
    axisMax,
    of: (value) => {
      const stats = statsRows.find((row) => row.key === value);
      const bins = binRows.filter((row) => row.key === value);
      return { summary: summarize(stats && toStats(stats)), bins: fillHistogram(bins, axisMax) };
    },
  };
}

/** "Quanto se paga por condição": todas as condições, com o resto dos filtros (D-45). */
export const getConditionDistribution = cache(async (filters: ResearchFilters): Promise<ConditionDistribution> => {
  await requireUser();
  const { axisMax, of } = await groupedDistribution(
    levelSchema,
    sql`coalesce(l.damage_level::text, 'unclassified')`,
    salesWhere(filters, { condition: false, ratio: true }),
  );
  const conditionRows = RESEARCH_CONDITIONS.map((condition) => ({
    condition,
    ...of(DAMAGE_OF_CONDITION[condition] ?? "unclassified"),
  }));
  return {
    rows: conditionRows,
    axisMax,
    looksMixed: unclassifiedLooksMixed(Object.fromEntries(conditionRows.map((row) => [row.condition, row.summary]))),
  };
});

/**
 * "De quem se compra" (docs/PLANO-MERCADO.md §6): o % da FIPE por origem inferida do veículo (D-73), com todos os
 * filtros, inclusive a condição: banco e seguradora vendem carros diferentes, e a condição não pode se misturar.
 */
export const getOriginDistribution = cache(async (filters: ResearchFilters): Promise<OriginDistribution> => {
  await requireUser();
  const { axisMax, of } = await groupedDistribution(
    z.enum(VEHICLE_ORIGINS),
    sql`l.vehicle_origin::text`,
    salesWhere(filters, { ratio: true }),
  );
  return { rows: VEHICLE_ORIGINS.map((origin) => ({ origin, ...of(origin) })), axisMax };
});

/**
 * Tendência (D-75): o resumo do % da FIPE por semana (segunda a domingo, UTC) com todos os filtros; só aparece com
 * semanas de base o bastante (`weeklyTrend`).
 */
export const getWeeklyTrend = cache(async (filters: ResearchFilters): Promise<WeeklyTrend> => {
  await requireUser();
  const byWeek = await rows(
    z.object({ week: z.date(), ...statsShape }),
    sql`SELECT date_trunc('week', l.ends_at AT TIME ZONE 'UTC') AS week, ${statsColumns(RATIO)}
      FROM listings l WHERE ${salesWhere(filters, { ratio: true })} GROUP BY 1 ORDER BY 1`,
  );
  const weeks = weeklyTrend(byWeek.map((row) => ({ start: row.week, stats: toStats(row) })));
  return {
    weeks:
      weeks?.flatMap(({ start, stats }) => {
        const summary = summarize(stats);
        return summary.kind === "summary" ? [{ start, summary }] : [];
      }) ?? null,
  };
});

/**
 * "Comparação": a distribuição do % do valor de mercado dos dois grupos (o dos filtros e o que a comparação troca), com
 * o resto dos filtros iguais e o mesmo fim de eixo. `null` sem comparação.
 */
export const getComparison = cache(async (filters: ResearchFilters): Promise<ComparisonView | null> => {
  await requireUser();
  const groups = comparisonGroups(filters);
  if (groups === null) return null;
  const parts = await Promise.all(groups.map((group) => ratioDistribution(salesWhere(group, { ratio: true }))));
  const axisMax = ratioAxisMax(Math.max(0, ...parts.map((part) => part.max ?? 0)) || null);
  return {
    axisMax,
    groups: groups.map((group, index) => ({
      label: groupLabel(group),
      distribution: {
        summary: summarize(parts[index]?.stats),
        bins: fillHistogram(parts[index]?.bins ?? [], axisMax),
      },
    })),
  };
});
