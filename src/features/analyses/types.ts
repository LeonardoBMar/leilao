import type { AnalysisInputs } from "@/domain/finance/calculator";
import type { DefaultsInput } from "@/domain/finance/defaults";
import type { Cents } from "@/domain/money";

import type { ListingFipe } from "./fipe-fill";
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

export type AnalysisLotRef = {
  id: string;
  lotNumber: string;
  title: string;
  currentBid: Cents | null;
  hasResult: boolean;
  auction: { id: string; name: string };
};

export type AnalysisDetail = {
  id: string;
  version: number;
  status: AnalysisStatus;
  inputs: AnalysisInputs;
  references: AnalysisReferences;
  outputs: AnalysisOutputs | null;
  fixedAt: Date | null;
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
