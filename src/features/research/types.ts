import type { DamageLevel } from "@/domain/listings/condition";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import type { Cents } from "@/domain/money";
import type { ResearchCategory, ResearchCondition, ResearchMetric } from "@/domain/research/filters";
import type { StateCode, StateSummary } from "@/domain/research/states";
import type { BidCurvePoint, GroupSummary, RankedModel } from "@/domain/research/summary";

/** Uma venda do catálogo, para as listas "uma a uma" e as vendas de um modelo. */
export type ResearchSale = {
  id: string;
  url: string;
  title: string;
  endsAt: Date;
  state: StateCode | null;
  city: string | null;
  modelYear: number | null;
  mileageKm: number | null;
  damageLevel: DamageLevel | null;
  finalBid: Cents;
  marketValue: Cents | null;
  /** Da fonte ou casado na FIPE pelo sistema (D-47). */
  marketValueOrigin: MarketValueOrigin | null;
  /** Lance final ÷ valor de mercado; `null` sem valor de mercado. */
  ratio: number | null;
  /** O % entra nas estatísticas (dentro de `RATIO_BOUNDS`); `false` também sem valor de mercado. */
  ratioInBounds: boolean;
  source: string;
  /** Primeira foto do anúncio, para a miniatura. */
  photoUrl: string | null;
};

/** Base da Pesquisa inteira, para o cabeçalho. */
export type ResearchOverview = {
  sales: number;
  /** Vendas com valor de mercado casado na FIPE pelo sistema (D-47), e não informado pela fonte. */
  fipeMatched: number;
  since: Date | null;
};

/** Distribuição do % do valor de mercado: resumo e histograma (contagem por faixa de 2 pontos). */
export type RatioDistribution = { summary: GroupSummary; bins: number[] };

export type ConditionDistribution = {
  rows: (RatioDistribution & { condition: ResearchCondition })[];
  /** Fim do eixo comum a todas as faixas. */
  axisMax: number;
  /** "Sem monta declarada" perto de pequena monta: a tela avisa que ela mistura avariados não classificados. */
  looksMixed: boolean;
};

export type StateMapView = { metric: ResearchMetric; states: StateSummary[] };

export type StateDetail = {
  state: StateCode;
  /** Vendas do estado no filtro, com ou sem valor de mercado. */
  sales: number;
  distribution: RatioDistribution;
  national: RatioDistribution;
  axisMax: number;
  sources: { name: string; sales: number }[];
  /** As vendas uma a uma, quando são poucas para uma mediana. */
  few: ResearchSale[];
};

/** Os dois grupos da comparação (modelo × modelo, estado × estado), na mesma escala. */
export type ComparisonView = {
  groups: { label: string; distribution: RatioDistribution }[];
  axisMax: number;
};

export type ModelRanking = RankedModel[];

export type ModelSales = {
  /** Vendas do modelo no filtro. */
  total: number;
  /** As mais recentes, até `MODEL_SALES_LIMIT`. */
  sales: ResearchSale[];
  /** Lance final (centavos) e % do valor de mercado por ano-modelo. */
  byYear: { year: number; summary: GroupSummary; ratio: GroupSummary }[];
};

export type BidCurveView = { points: BidCurvePoint[] };

/** Modelo sugerido na busca, com as vendas na categoria e condição do filtro. */
export type ResearchModelOption = { brand: string; model: string; label: string; sales: number };

/** Contagens da barra de filtros. */
export type ResearchFacets = {
  conditions: Record<ResearchCondition, number>;
  categories: Record<ResearchCategory, number>;
  /** Vendas por estado, com os outros filtros: o estado do mapa não entra. */
  states: Partial<Record<StateCode, number>>;
  /** Vendas por fonte, com os outros filtros (a fonte escolhida não entra), da que tem mais vendas à que tem menos. */
  sources: { id: string; name: string; sales: number }[];
  /** Vendas do filtro sem o km máximo, e quantas delas têm km informado. */
  mileage: { total: number; known: number };
  /** Anos-modelo do modelo escolhido, do mais novo ao mais velho, com as vendas de cada um; vazio sem modelo. */
  years: { year: number; sales: number }[];
  models: ResearchModelOption[];
};
