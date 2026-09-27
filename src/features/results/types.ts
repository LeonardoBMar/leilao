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
};

export type LotResultContext = {
  lot: { id: string; lotNumber: string; title: string; auction: { id: string; name: string; startsAt: Date } };
  /** Revisão vigente: a de maior número (RF-06). */
  current: ResultRevision | null;
  /** Todas as revisões, da mais recente para a mais antiga. */
  revisions: ResultRevision[];
  /** Versões fixadas do lote, candidatas ao vínculo. */
  fixedAnalyses: LinkedAnalysis[];
  /** Última análise fixada elegível (não retrospectiva), sugerida no formulário (RF-05). */
  suggestedAnalysisId: string | null;
};
