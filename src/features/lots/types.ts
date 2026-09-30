import type { Cents } from "@/domain/money";

/** Limite da análise fixada mais recente do lote. */
export type LotLimit = { isViable: boolean; maxBid: Cents | null; version: number; fixedAt: Date };

export type LotAuctionRef = { id: string; name: string; startsAt: Date; archivedAt: Date | null };

export type LotListItem = {
  id: string;
  lotNumber: string;
  brand: string;
  model: string;
  vehicleVersion: string | null;
  modelYear: number;
  isFollowed: boolean;
  currentBid: Cents | null;
  currentBidObservedAt: Date | null;
  archivedAt: Date | null;
  auction: LotAuctionRef;
  limit: LotLimit | null;
  hasResult: boolean;
};

export type LotPage = { items: LotListItem[]; total: number; page: number; pageSize: number };

export type LotDetail = LotListItem & {
  manufactureYear: number | null;
  mileageKm: number | null;
  startingBid: Cents | null;
  lotUrl: string | null;
  notes: string | null;
  fixedAnalysisCount: number;
  resultCount: number;
  updatedAt: Date;
  /** Anúncio coletado ligado ao lote: o coletor mantém o lance atual (etapa 3). */
  tracking: { sourceName: string; lastCheckedAt: Date } | null;
};
