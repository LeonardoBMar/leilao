import type { ConditionFlag, DamageLevel, InspectionResult } from "@/domain/listings/condition";
import type { CollectorHealth } from "@/domain/listings/health";
import type { ListingStatus } from "@/domain/listings/types";
import type { Cents } from "@/domain/money";

/** Anúncio coletado, como aparece em "Descobertos". */
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
  /** Valor de mercado informado pela fonte (D-30). */
  marketValue: Cents | null;
  photoUrl: string | null;
  /** Tem o que `planTracker` exige (marca, modelo, ano e leilão): pode virar lote ("Adicionar à análise"). */
  trackable: boolean;
  /** Lote do usuário ligado a este anúncio (já está no Tracker). */
  trackedLotId: string | null;
};

export type ListingPage = {
  items: ListingListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Mais candidatos que o teto da busca por raio: o total é parcial e a tela avisa. */
  truncated: boolean;
};

export type CollectorStatus = {
  /** Resume a última execução e o agendamento: interrompida conta como falha; parada há 4 h, como atraso. */
  health: CollectorHealth;
  lastRun: {
    sourceName: string;
    status: "running" | "succeeded" | "failed";
    startedAt: Date;
    finishedAt: Date | null;
    created: number;
    failed: number;
  } | null;
  /** Anúncios abertos dentro da região padrão. */
  openInRegion: number;
  regionLabel: string;
  radiusKm: number;
};
