import type { Route } from "next";

import type { DamageLevel } from "@/domain/listings/condition";
import type { ComparableLevel, EstimateConfidence, EstimateSale, EstimateTarget } from "@/domain/listings/estimates";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import type { VehicleOrigin } from "@/domain/listings/origin";
import type { Cents } from "@/domain/money";
import type { Evaluation } from "@/domain/research/evaluate";
import type { ResearchCategory, ResearchCondition, ResearchMetric } from "@/domain/research/filters";
import type { SaleBidStep } from "@/domain/research/sale-bids";
import type { StateCode, StateSummary } from "@/domain/research/states";
import type { BidCurvePoint, DistanceBand, GroupSummary, RankedModel } from "@/domain/research/summary";

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
  /** Lances distintos vistos nas 48 h antes do fim, com o final: com 2 ou mais, há subida para mostrar. */
  bidSteps: number;
};

/** Lances de uma venda antes do fim, em degraus (`saleBidSteps`). */
export type SaleBids = {
  id: string;
  title: string;
  url: string;
  endsAt: Date;
  finalBid: Cents;
  marketValue: Cents | null;
  steps: SaleBidStep[];
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

export type OriginDistribution = {
  rows: (RatioDistribution & { origin: VehicleOrigin })[];
  /** Fim do eixo comum a todas as faixas. */
  axisMax: number;
};

export type ConditionDistribution = {
  rows: (RatioDistribution & { condition: ResearchCondition })[];
  /** Fim do eixo comum a todas as faixas. */
  axisMax: number;
  /** "Sem monta declarada" perto de pequena monta: a tela avisa que ela mistura avariados não classificados. */
  looksMixed: boolean;
};

/**
 * "Onde": o resumo por faixa de distância da região padrão (`null` = cidade do pátio não identificada) e por estado e
 * fonte, na medida do mapa.
 */
export type WhereView = {
  metric: ResearchMetric;
  distance: { band: DistanceBand | null; summary: GroupSummary }[];
  places: { state: StateCode; source: { id: string; name: string }; summary: GroupSummary }[];
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

export type ModelRanking = {
  models: RankedModel[];
  /** Semanas entre a primeira e a última venda do filtro: a base de "vendas por semana". */
  weeks: number;
};

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

/** Venda do modelo para o Avaliar: o que o cálculo usa e o que a lista mostra. */
export type EvaluateSaleView = EstimateSale & {
  url: string;
  title: string;
  state: StateCode | null;
  city: string | null;
  source: string;
  photoUrl: string | null;
};

/** Resultado do Avaliar com os nomes das versões FIPE para os seletores. */
export type EvaluationView = Evaluation<EvaluateSaleView> & {
  /** Vendas do modelo base no último ano, antes do recorte. */
  modelSales: number;
  versionLabels: Readonly<Record<string, string>>;
};

/** Lote do usuário como alvo do Avaliar. */
export type LotTarget = {
  id: string;
  label: string;
  target: EstimateTarget;
  /** Fim do anúncio ligado ainda aberto; `null` sem anúncio ou já encerrado. */
  endsAt: Date | null;
};

/**
 * Mercado do lote para a análise (docs/PLANO-MERCADO.md §8): as vendas do recorte do preço provável que entram na
 * conta, a faixa e o recorte em palavras. Serializável: vai para o resumo da análise (client) e para o snapshot.
 */
export type LotMarketReference = {
  level: ComparableLevel;
  /** O recorte em palavras ("Chevrolet Onix · 2022 a 2024 · Sem monta declarada"). */
  scope: string;
  /** Avaliar com o lote como alvo. */
  href: Route;
  /** Vendas que entram na conta, com o lance final. */
  sales: { id: string; finalBid: Cents }[];
  /** Faixa típica; `null` com menos de 5 vendas. */
  band: { low: Cents; median: Cents; high: Cents; confidence: EstimateConfidence } | null;
};

/** Lote aberto do recorte do Avaliar. */
export type EvaluateOpenListing = {
  id: string;
  url: string;
  title: string;
  modelYear: number | null;
  mileageKm: number | null;
  endsAt: Date | null;
  currentBid: Cents | null;
  state: StateCode | null;
  city: string | null;
  source: string;
  photoUrl: string | null;
  /** Lote do usuário já ligado ao anúncio. */
  trackedLotId: string | null;
  /** Tem marca, modelo e ano para virar lote. */
  trackable: boolean;
};
