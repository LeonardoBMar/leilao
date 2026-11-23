import type { LimitFit, PriceEstimate } from "@/domain/listings/estimates";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
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
  openDraftId: string | null;
  hasResult: boolean;
};

export type LotPage = { items: LotListItem[]; total: number; page: number; pageSize: number };

/** Lote acompanhado no dashboard (D-44): fim do anúncio ligado e o provável frente ao limite fixado. */
export type FollowedLotItem = LotListItem & {
  /** Fim do anúncio ligado; nulo em lote manual ou anúncio sem data. */
  endsAt: Date | null;
  /** Só com anúncio aberto ligado (D-36); `insufficient` diz quantos comparáveis faltam. */
  price: PriceEstimate | null;
  fit: LimitFit | null;
};

export type FollowedLotsOverview = {
  items: FollowedLotItem[];
  /** Com o provável acima do limite fixado. */
  aboveLimit: number;
  now: Date;
};

/** Leilão do usuário com os lotes que atendem aos filtros ("Minhas análises" por leilão). */
export type LotAuctionGroup = {
  auction: LotAuctionRef & {
    auctioneer: string;
    /** Leilão do catálogo de onde veio ("Adicionar à análise"), com o total de lotes coletados. */
    catalog: { sourceId: string; externalId: string; total: number } | null;
  };
  lots: LotListItem[];
};

export type LotGroupPage = { groups: LotAuctionGroup[]; total: number; page: number; pageSize: number };

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
  tracking: {
    sourceName: string;
    lastCheckedAt: Date;
    endsAt: Date | null;
    /** Valor de mercado do anúncio, com a origem (D-47). */
    market: { value: Cents; origin: MarketValueOrigin; refMonth: Date | null } | null;
    /** Provável lance final, só com o anúncio aberto (D-36). */
    price: PriceEstimate | null;
    fit: LimitFit | null;
  } | null;
};
