import type { ListingOutcome } from "@/domain/listings/outcome";
import type { Cents } from "@/domain/money";
import type { AnalysisTiming, LotOutcome, PersonalOutcome } from "@/domain/results/results";

export type LinkedAnalysis = {
  id: string;
  version: number;
  isViable: boolean;
  maxBid: Cents | null;
  fixedAt: Date;
  knownResultAtCreation: boolean;
};

export type ResultRevision = {
  id: string;
  revision: number;
  outcome: LotOutcome;
  finalBid: Cents | null;
  eventAt: Date | null;
  sourceUrl: string | null;
  sourceNotes: string | null;
  personalOutcome: PersonalOutcome;
  decisionReason: string | null;
  notes: string | null;
  analysis: LinkedAnalysis | null;
  analysisTiming: AnalysisTiming;
  priorDeclared: boolean;
  recordedAt: Date;
  correctionReason: string | null;
  /** Quem registrou: o usuário ou o coletor (etapa 4). */
  source: "manual" | "collector";
};

/** Valores iniciais do formulário quando o lote ainda não tem resultado e o anúncio ligado já encerrou. */
export type ResultPrefill = {
  /** Vazio quando o desfecho é ambíguo: o usuário escolhe. */
  outcome: LotOutcome | null;
  finalBid: Cents | null;
  eventAt: Date | null;
  sourceUrl: string;
  sourceNotes: string;
};

/** Anúncio coletado ligado ao lote e o que o desfecho dele significa (src/domain/listings/outcome.ts). */
export type ResultTracking = { sourceName: string; url: string; outcome: ListingOutcome };

export type LotResultContext = {
  lot: {
    id: string;
    lotNumber: string;
    title: string;
    /** Lance atual do lote (ou do anúncio ligado): sugestão de preço final. */
    currentBid: Cents | null;
    auction: { id: string; name: string; startsAt: Date };
  };
  /** Revisão vigente: a de maior número (RF-06). */
  current: ResultRevision | null;
  /** Todas as revisões, da mais recente para a mais antiga. */
  revisions: ResultRevision[];
  /** Versões fixadas do lote, candidatas ao vínculo. */
  fixedAnalyses: LinkedAnalysis[];
  /** Última análise fixada elegível (não retrospectiva), sugerida no formulário (RF-05). */
  suggestedAnalysisId: string | null;
  tracking: ResultTracking | null;
  /** Só sem resultado registrado e com desfecho na fonte ("resultado a confirmar" ou antes do coletor gravar). */
  prefill: ResultPrefill | null;
};
