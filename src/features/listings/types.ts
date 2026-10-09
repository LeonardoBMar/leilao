import type { CatalogAuctionState, CatalogAuctionStats } from "@/domain/listings/catalog-auctions";
import type { ConditionFlag, DamageLevel, InspectionResult } from "@/domain/listings/condition";
import type { LimitEstimate, LimitFit, PriceEstimate } from "@/domain/listings/estimates";
import type { ListingFacets } from "@/domain/listings/facets";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import type { CollectorHealth } from "@/domain/listings/health";
import type { ListingStatus } from "@/domain/listings/types";
import type { Cents } from "@/domain/money";

/** Anúncio coletado, como aparece em "Leilões". */
export type ListingListItem = {
  id: string;
  sourceName: string;
  url: string;
  lotNumber: string | null;
  title: string;
  modelYear: number | null;
  mileageKm: number | null;
  fuel: string | null;
  recoveryType: string | null;
  /** Condição declarada pelo leiloeiro; nula quando não informada. */
  damageLevel: DamageLevel | null;
  conditionFlags: ConditionFlag[];
  inspection: InspectionResult | null;
  inspectionNotes: string | null;
  city: string | null;
  state: string | null;
  /** Distância em linha reta até a região padrão; nula se a cidade não foi reconhecida. */
  distanceKm: number | null;
  auctionName: string | null;
  endsAt: Date | null;
  status: ListingStatus;
  currentBid: Cents | null;
  minimumBid: Cents | null;
  bidCount: number | null;
  finalBid: Cents | null;
  /** Valor de mercado da fonte (D-30) ou casado na FIPE pelo sistema (D-47); a origem vai no rótulo. */
  marketValue: Cents | null;
  marketValueOrigin: MarketValueOrigin | null;
  /** Mês da tabela FIPE do valor casado. */
  marketValueRefMonth: Date | null;
  photoUrl: string | null;
  /** Tem o que `planTracker` exige (marca, modelo, ano e leilão): pode virar lote ("Adicionar à análise"). */
  trackable: boolean;
  /** Lote do usuário ligado a este anúncio (já está no Tracker). */
  trackedLotId: string | null;
  /** Só em anúncio aberto e quando a tela carrega a base (D-36). */
  estimate: ListingEstimate | null;
};

/**
 * Preço provável (catálogo) e limite estimado (análises do usuário ou premissas padrão), cada um com a própria base, e
 * a situação do provável frente a esse limite (D-44).
 */
export type ListingEstimate = { price: PriceEstimate; limit: LimitEstimate; fit: LimitFit | null };

export type ListingPage = {
  items: ListingListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Mais candidatos que o teto da busca por raio: o total é parcial e a tela avisa. */
  truncated: boolean;
};

/** Contagens dos chips e sugestões da busca; fontes ativas com nome, inclusive as sem anúncio no filtro. */
export type ListingFacetsView = Omit<ListingFacets, "sources"> & {
  sources: { id: string; name: string; count: number }[];
};

/** Leilão do catálogo (D-42): fonte e id do leilão na fonte. */
export type CatalogAuctionKey = { sourceId: string; externalId: string };

export type CatalogAuctionItem = CatalogAuctionStats & CatalogAuctionState & { sourceName: string };

export type CatalogAuctionPage = {
  items: CatalogAuctionItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Mais candidatos que o teto da busca por raio: as contagens são parciais e a tela avisa. */
  truncated: boolean;
};

/** Leilão do catálogo na home: `matching` = lotes no filtro que encerram em 7 dias; `fitting` = quantos cabem. */
export type RegionAuction = CatalogAuctionItem & { fitting: number };

/** O catálogo visto da home (D-44). */
export type RegionOverview = {
  /** Os primeiros de "Para analisar agora", na ordem da regra. */
  toAnalyze: ListingListItem[];
  toAnalyzeTotal: number;
  /** Próximos leilões na região, do mais próximo. */
  auctions: RegionAuction[];
  auctionsTotal: number;
  /** Mais candidatos que o teto da busca: as contagens são parciais. */
  truncated: boolean;
};

/** Leilão do catálogo na sua página; `matching` não se aplica (a lista de anúncios abaixo tem o total do filtro). */
export type CatalogAuctionDetail = CatalogAuctionItem & {
  /** Registro do usuário para este leilão (criado por "Adicionar à análise"), se existir. */
  userAuctionId: string | null;
};

export type CollectorStatus = {
  /**
   * A pior entre as últimas execuções de cada fonte ativa: interrompida conta como falha; parada há 4 h, como atraso.
   */
  health: CollectorHealth;
  /** Fim da execução mais recente, de qualquer fonte. */
  lastFinishedAt: Date | null;
  /** Fontes cuja última execução falhou (nome para exibir). */
  failingSources: string[];
  /** Anúncios com falha nas últimas execuções, somando as fontes. */
  failedListings: number;
  /** Anúncios abertos dentro da região padrão. */
  openInRegion: number;
  regionLabel: string;
  radiusKm: number;
};
