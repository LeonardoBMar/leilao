import type { AuctionOrigin, AuctionStatus } from "./schemas";

export type AuctionListItem = {
  id: string;
  name: string;
  auctioneer: string;
  origin: AuctionOrigin;
  status: AuctionStatus;
  startsAt: Date;
  /** Lotes não arquivados. */
  lotCount: number;
  archivedAt: Date | null;
};

export type AuctionDetail = AuctionListItem & {
  city: string | null;
  state: string | null;
  noticeUrl: string | null;
  platformUrl: string | null;
  notes: string | null;
  /** Lotes vinculados, inclusive arquivados: impede a exclusão definitiva (RF-08). */
  totalLotCount: number;
  updatedAt: Date;
  /** Leilão do catálogo de onde veio ("Adicionar à análise", D-42): fonte e id do leilão na fonte. */
  catalog: { sourceId: string; externalId: string } | null;
};
