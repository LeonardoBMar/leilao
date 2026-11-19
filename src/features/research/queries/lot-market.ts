import "server-only";

import { cache } from "react";

import { DEFAULT_EVALUATE_FILTERS, evaluate, type EvaluateFilters, targetFilters } from "@/domain/research/evaluate";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { evaluateScopeLabel } from "../labels";
import { evaluateHref } from "../search";
import type { EvaluationView, LotMarketReference } from "../types";
import {
  getEvaluation,
  getLotTarget,
  keyOfVehicle,
  loadModelSales,
  lotTargetSelect,
  salesInWindow,
  toLotTarget,
} from "./evaluate";
import { loadFipeVersionLabels, salesSince } from "./sql";

function bandOf(answer: EvaluationView["answer"]): LotMarketReference["band"] {
  return answer.kind === "band"
    ? { low: answer.low, median: answer.median, high: answer.high, confidence: answer.confidence }
    : null;
}

function toLotMarketReference(
  lotId: string,
  filters: EvaluateFilters,
  evaluation: Pick<EvaluationView, "level" | "comparables" | "answer">,
  versionLabels: Record<string, string>,
): LotMarketReference {
  return {
    level: evaluation.level,
    scope: evaluateScopeLabel(filters, versionLabels),
    href: evaluateHref({ ...DEFAULT_EVALUATE_FILTERS, lot: lotId }),
    sales: evaluation.comparables.flatMap(({ sale, excluded }) =>
      excluded ? [] : [{ id: sale.id, finalBid: sale.finalBid }],
    ),
    band: bandOf(evaluation.answer),
  };
}

/**
 * Mercado do lote para a análise (bloco Concorrência e snapshot da fixação, docs/PLANO-MERCADO.md §8): o mesmo recorte
 * do preço provável e do painel da ficha. Com `until`, só as vendas encerradas antes dele (a faixa da época, para a
 * Calibração). Lote de outro dono ou sem marca e modelo é `null`.
 */
export const getLotMarketReference = cache(
  async (lotId: string, until: Date | null = null): Promise<LotMarketReference | null> => {
    const lot = await getLotTarget(lotId);
    if (lot === null) return null;
    const filters = targetFilters(lot.target, lot.id, []);
    const evaluation = await getEvaluation(filters, lot.target, until);
    if (evaluation === null) return null;
    return toLotMarketReference(lot.id, filters, evaluation, evaluation.versionLabels);
  },
);

/**
 * Mesma referência de `getLotMarketReference`, em lote (duas consultas para todos os lotes, sem N+1) para fixar vários
 * rascunhos de uma só vez.
 */
export async function getLotMarketReferences(
  lotIds: readonly string[],
  until: Date | null = null,
): Promise<Map<string, LotMarketReference>> {
  const user = await requireUser();
  if (lotIds.length === 0) return new Map();
  const uniqueLotIds = [...new Set(lotIds)];
  const lots = await db.lot.findMany({
    where: { id: { in: uniqueLotIds }, ownerId: user.id },
    select: lotTargetSelect,
  });
  const wanted = lots.flatMap((raw) => {
    const lot = toLotTarget(raw);
    const filters = targetFilters(lot.target, lot.id, []);
    return filters.vehicle === null
      ? []
      : [{ lotId: raw.id, target: lot.target, filters, key: keyOfVehicle(filters.vehicle) }];
  });
  if (wanted.length === 0) return new Map();

  const sales = await loadModelSales([...new Set(wanted.map((item) => item.key))], salesSince(until), until);
  const evaluated = wanted.map((item) => ({
    ...item,
    evaluation: evaluate(salesInWindow(sales, item.key, until), item.filters, item.target),
  }));
  const versionLabels = await loadFipeVersionLabels(
    evaluated.flatMap(({ evaluation }) => evaluation.versions.map((option) => option.value)),
  );

  return new Map(
    evaluated.map(({ lotId, filters, evaluation }) => [
      lotId,
      toLotMarketReference(lotId, filters, evaluation, versionLabels),
    ]),
  );
}

/**
 * Faixa da época de vários lotes do usuário (Calibração): a mesma de `getLotMarketReference` com `until`, mas com os
 * lotes numa consulta e as vendas de todos os modelos noutra, em vez de três consultas por lote (D-79). Lote de outro
 * dono, sem marca e modelo ou com menos de 5 vendas fica sem faixa.
 */
export async function getLotMarketBands(
  items: readonly { lotId: string; until: Date }[],
): Promise<Map<string, LotMarketReference["band"]>> {
  const user = await requireUser();
  if (items.length === 0) return new Map();
  const lots = await db.lot.findMany({
    where: { id: { in: items.map((item) => item.lotId) }, ownerId: user.id },
    select: lotTargetSelect,
  });
  const targets = new Map(lots.map((lot) => [lot.id, toLotTarget(lot)]));
  const wanted = items.flatMap(({ lotId, until }) => {
    const lot = targets.get(lotId);
    if (lot === undefined) return [];
    const filters = targetFilters(lot.target, lot.id, []);
    return filters.vehicle === null
      ? []
      : [{ lotId, until, target: lot.target, filters, key: keyOfVehicle(filters.vehicle) }];
  });
  if (wanted.length === 0) return new Map();
  const untils = wanted.map((item) => item.until.getTime());
  const sales = await loadModelSales(
    [...new Set(wanted.map((item) => item.key))],
    salesSince(new Date(Math.min(...untils))),
    new Date(Math.max(...untils)),
  );
  return new Map(
    wanted.map(({ lotId, until, target, filters, key }) => [
      lotId,
      bandOf(evaluate(salesInWindow(sales, key, until), filters, target).answer),
    ]),
  );
}
