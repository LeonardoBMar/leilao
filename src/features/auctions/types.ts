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

export type AuctionPage = {
  items: AuctionListItem[];
  total: number;
  page: number;
  pageSize: number;
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
};
