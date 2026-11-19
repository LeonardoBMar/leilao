import type { AnalysisInputs } from "@/domain/finance/calculator";
import type { DefaultsInput } from "@/domain/finance/defaults";
import type { ConditionFlag, DamageLevel, InspectionResult } from "@/domain/listings/condition";
import type { Cents } from "@/domain/money";

import type { ListingFipe } from "./fipe-fill";
import type { MarketSnapshot } from "./market-snapshot";
import type { AnalysisReferences } from "./schemas";

export type AnalysisStatus = "draft" | "fixed";

/** Saídas preservadas no momento da fixação (nunca recalculadas depois; SPEC §8). */
export type AnalysisOutputs = {
  isViable: boolean;
  maxBid: Cents | null;
  totalAtMaxBid: Cents | null;
  marginAtMaxBid: Cents | null;
  formulaVersion: number;
};

export type AnalysisVehicleContext = {
  vehicleVersion: string | null;
  mileageKm: number | null;
  lotUrl: string | null;
  sourceName: string | null;
  city: string | null;
  state: string | null;
  endsAt: Date | null;
  fuel: string | null;
  hasKey: boolean | null;
  recoveryType: string | null;
  damageLevel: DamageLevel | null;
  conditionFlags: ConditionFlag[];
  inspection: InspectionResult | null;
  inspectionNotes: string | null;
  /** Fotos do anúncio ligado (D-29); fotos privadas do lote são combinadas na tela. */
  listingPhotoUrls: string[];
};

export type AnalysisLotRef = {
  id: string;
  lotNumber: string;
  title: string;
  currentBid: Cents | null;
  hasResult: boolean;
  auction: { id: string; name: string };
  context: AnalysisVehicleContext;
};

export type AnalysisDetail = {
  id: string;
  version: number;
  status: AnalysisStatus;
  inputs: AnalysisInputs;
  references: AnalysisReferences;
  outputs: AnalysisOutputs | null;
  fixedAt: Date | null;
  /** Mercado do lote na fixação (D-74); `null` em rascunhos e nas fixadas antes do registro. */
  marketSnapshot: MarketSnapshot | null;
  createdAt: Date;
  updatedAt: Date;
  /** Condição do veículo (do anúncio ligado) para estimar venda e reparos a partir da FIPE (D-38). */
  vehicle: Pick<DefaultsInput, "isMotorcycle" | "damageLevel" | "airbagDeployed" | "missingParts">;
  lot: AnalysisLotRef;
  /** FIPE do anúncio ligado ao lote, para "Usar FIPE do anúncio"; `null` sem anúncio ou sem valor de mercado. */
  listingFipe: ListingFipe | null;
  /** Rascunho aberto do mesmo lote (no máximo um; RF-05). */
  openDraftId: string | null;
};

export type AnalysisVersion = {
  id: string;
  version: number;
  status: AnalysisStatus;
  isViable: boolean | null;
  maxBid: Cents | null;
  knownResultAtCreation: boolean;
  fixedAt: Date | null;
  updatedAt: Date;
};

/**
 * Análise fixada antes do desfecho de um lote arrematado (Calibração, docs/PLANO-MERCADO.md §7): o limite da época, o
 * arremate e a faixa típica do mercado na fixação, só com vendas encerradas antes dela.
 */
export type CalibrationItem = {
  lotId: string;
  analysisId: string;
  label: string;
  /** Categoria do anúncio ligado, para a quebra por categoria; `null` sem anúncio. */
  category: string | null;
  fixedAt: Date;
  /** Limite fixado; `null` quando a análise concluiu que não havia lance viável. */
  limit: Cents | null;
  finalBid: Cents;
  band: { low: Cents; median: Cents; high: Cents } | null;
  /** De onde veio a faixa: o snapshot gravado na fixação (D-74) ou o recálculo com as vendas anteriores a ela. */
  bandSource: "snapshot" | "recomputed";
};
