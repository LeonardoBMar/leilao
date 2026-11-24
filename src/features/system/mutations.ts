import "server-only";

import { fipeFuelCodes, type FipeMatchModel, pickFipeTable } from "@/domain/listings/fipe-match";
import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { createFipeCatalog } from "@/server/fipe/catalog";
import { type FipeMatchChoice, getFipeMatch, resetMatchToAuto, setManualMatch } from "@/server/fipe/matches";

import type { SaveManualFipeMatchInput } from "./schemas";

export type ToggleSourceError = "not_found";

/**
 * Pausa ou reativa uma fonte do catálogo global (D-88).
 * Operação administrativa do proprietário; invalida a tag `collector-status` na action.
 */
export async function setSourceActive(
  sourceId: string,
  active: boolean,
): Promise<Result<{ sourceId: string; active: boolean }, ToggleSourceError>> {
  await requireUser();
  const { count } = await db.source.updateMany({
    where: { id: sourceId },
    data: { active },
  });
  return count === 0 ? err("not_found") : ok({ sourceId, active });
}

export type SaveManualFipeError = "not_found" | "catalog_empty" | "brand_required" | "invalid_models";

/**
 * Grava uma correlação FIPE manual (versão, família ou sem FIPE) validando todos os códigos no servidor
 * contra a tabela FIPE atual (D-49, D-88). Os anúncios afetados voltam à fila automaticamente.
 */
export async function saveManualFipeMatch(
  input: SaveManualFipeMatchInput,
): Promise<Result<{ requeued: number }, SaveManualFipeError>> {
  await requireUser();
  const match = await getFipeMatch(input.matchId);
  if (!match) return err("not_found");

  let choice: FipeMatchChoice;
  if (input.mode === "none") {
    // Em `none`, preserva os metadados originais do match sem gravar marca/tipo não validados vindos do cliente.
    choice = {
      kind: "none",
      reason: "manual",
      vehicleType: match.vehicleType,
      brandCode: match.brandCode,
    };
  } else {
    const vehicleType = input.vehicleType ?? match.vehicleType;
    const brandCode = input.brandCode ?? match.brandCode;
    if (vehicleType === null || !brandCode) return err("brand_required");

    const catalog = createFipeCatalog();
    const table = pickFipeTable(new Date(), await catalog.tables());
    if (!table) return err("catalog_empty");

    const found: FipeMatchModel[] = [];
    for (const fuel of fipeFuelCodes(vehicleType, match.fuel)) {
      const models = await catalog.modelsByYear(table, vehicleType, brandCode, match.modelYear, fuel);
      for (const model of models) {
        if (!found.some((item) => item.code === model.code)) {
          found.push({ code: model.code, fuel, label: model.label });
        }
      }
    }

    const uniqueCodes = Array.from(new Set(input.modelCodes));
    const selected: FipeMatchModel[] = [];
    for (const code of uniqueCodes) {
      const candidate = found.find((item) => item.code === code);
      if (!candidate) return err("invalid_models");
      selected.push(candidate);
    }
    if (selected.length === 0) return err("invalid_models");

    choice = {
      kind: selected.length === 1 ? "version" : "family",
      vehicleType,
      brandCode,
      models: selected,
    };
  }

  const requeued = await setManualMatch(match.id, choice);
  return ok({ requeued });
}

export type ResetFipeMatchError = "not_found";

/** Desfaz uma correlação FIPE manual para a regra automática recalcular na próxima coleta. */
export async function revertFipeMatchToAuto(
  matchId: string,
): Promise<Result<{ requeued: number }, ResetFipeMatchError>> {
  await requireUser();
  const match = await getFipeMatch(matchId);
  if (!match) return err("not_found");
  const requeued = await resetMatchToAuto(match.id);
  return ok({ requeued });
}
