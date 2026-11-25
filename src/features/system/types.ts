import type { FipeMatchModel, FipeOption, FipeVehicleType } from "@/domain/listings/fipe-match";
import type { CollectorHealth } from "@/domain/listings/health";

export type CollectorRunErrorSample = {
  url: string;
  error: string;
};

export type SystemCollectorRun = {
  id: string;
  status: "running" | "succeeded" | "failed";
  startedAt: Date;
  finishedAt: Date | null;
  durationSec: number | null;
  requests: number;
  discovered: number;
  created: number;
  updated: number;
  failed: number;
  alertsCreated: number;
  errors: CollectorRunErrorSample[];
};

export type SystemSourceOverview = {
  id: string;
  name: string;
  baseUrl: string;
  active: boolean;
  health: CollectorHealth;
  openListings: number;
  runs: SystemCollectorRun[];
};

export type SystemCollectorOverview = {
  sources: SystemSourceOverview[];
  activeCount: number;
  pausedCount: number;
  failingCount: number;
  lateCount: number;
  totalOpenListings: number;
};

export type SystemFipeSummary = {
  /** Chaves ativas sem casamento que são identificáveis / revisáveis. */
  reviewable: number;
  /** Chaves ativas sem casamento por divergência real (fora da FIPE, ano fora da faixa, manual). */
  outOfFipe: number;
  matched: number;
  manual: number;
  pendingListings: number;
  latestTableMonth: Date | null;
};

export type SystemFipeMatchItem = {
  id: string;
  vehicleKey: string;
  modelYear: number;
  fuel: string | null;
  kind: "version" | "family" | "none";
  reason: string | null;
  vehicleType: FipeVehicleType | null;
  brandCode: string | null;
  models: FipeMatchModel[];
  origin: "auto" | "manual";
  matcherVersion: number;
  listings: number;
};

export type SystemFipeMatchEditor = {
  match: SystemFipeMatchItem;
  tableMonth: Date | null;
  selectedType: FipeVehicleType | null;
  selectedBrand: string | null;
  brands: FipeOption[];
  candidates: { code: string; fuel: number; label: string }[];
};
