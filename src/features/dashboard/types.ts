import type { FixableDraftItem } from "@/features/analyses/types";

/** Indicador inicial do SPEC §10: comparáveis com análise anterior e quantos ficaram dentro do limite. */
export type LimitIndicator = { comparable: number; withinLimit: number };

export type FixableDraftPreview = FixableDraftItem;

/** Atalhos para concluir registros (SPEC §5): rascunhos abertos e lotes que aguardam resultado. */
export type PendingItems = {
  drafts: {
    analysisId: string;
    version: number;
    lotId: string;
    lotLabel: string;
    auctionName: string;
    startsAt: Date;
    canFix: boolean;
  }[];
  draftsTotal: number;
  fixableDraftsTotal: number;
  fixableDrafts: FixableDraftPreview[];
  awaitingResult: { lotId: string; lotLabel: string; auctionName: string; startsAt: Date }[];
  awaitingResultTotal: number;
};
