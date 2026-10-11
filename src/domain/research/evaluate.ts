import type { VehicleOrigin } from "../listings/origin";
import type { ResearchCondition, ResearchMileage, ResearchVehicle } from "./filters";

/**
 * Avaliar (docs/PLANO-MERCADO.md §5, D-71): quanto um veículo costuma sair em leilão. O recorte é o modelo base e,
 * se o usuário quiser estreitar, a família ou a versão FIPE, com ano, km, condição e origem. Puro.
 */

export type EvaluateFilters = {
  vehicle: ResearchVehicle | null;
  /** `vehicleFamilyKey` da família escolhida; só com modelo. */
  family: string | null;
  /** Código FIPE da versão escolhida ("005205-1"); só com modelo. */
  version: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  maxKm: ResearchMileage | null;
  condition: ResearchCondition;
  origin: VehicleOrigin | null;
  /** Lote do usuário que serve de alvo (preenche o recorte e ordena as vendas pela semelhança). */
  lot: string | null;
  /** Vendas que o usuário tirou da conta. */
  excluded: readonly string[];
};

export const DEFAULT_EVALUATE_FILTERS: EvaluateFilters = {
  vehicle: null,
  family: null,
  version: null,
  yearFrom: null,
  yearTo: null,
  maxKm: null,
  condition: "sem-monta",
  origin: null,
  lot: null,
  excluded: [],
};

/** Até quantas vendas excluídas a URL guarda: mais que isso é outro recorte, não exclusão. */
export const MAX_EXCLUDED = 50;
