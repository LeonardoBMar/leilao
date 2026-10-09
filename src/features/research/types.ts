import type { DamageLevel } from "@/domain/listings/condition";
import type { Cents } from "@/domain/money";
import type { ResearchCondition, ResearchMetric } from "@/domain/research/filters";
import type { BidCurvePoint, GroupSummary, RankedModel } from "@/domain/research/summary";
import type { StateCode, StateTile } from "@/domain/research/tile-map";

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
  /** Lance final ÷ valor de mercado; `null` sem valor de mercado. */
  ratio: number | null;
  source: string;
};

/** Base da Pesquisa inteira, para o cabeçalho. */
export type ResearchOverview = { sales: number; since: Date | null };

/** Distribuição do % do valor de mercado: resumo e histograma (contagem por faixa de 2 pontos). */
export type RatioDistribution = { summary: GroupSummary; bins: number[] };

export type ConditionDistribution = {
  rows: (RatioDistribution & { condition: ResearchCondition })[];
  /** Fim do eixo comum a todas as faixas. */
  axisMax: number;
  /** "Sem monta declarada" perto de pequena monta: a tela avisa que ela mistura avariados não classificados. */
  looksMixed: boolean;
};

export type StateMapView = { metric: ResearchMetric; tiles: StateTile[] };

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

export type ModelRanking = RankedModel[];

export type ModelSales = {
  /** Vendas do modelo no filtro. */
  total: number;
  /** As mais recentes, até `MODEL_SALES_LIMIT`. */
  sales: ResearchSale[];
  /** Lance final (centavos) por ano-modelo. */
  byYear: { year: number; summary: GroupSummary }[];
};

export type BidCurveView = { points: BidCurvePoint[] };
