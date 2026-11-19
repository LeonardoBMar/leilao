/** Indicador inicial do SPEC §10: comparáveis com análise anterior e quantos ficaram dentro do limite. */
export type LimitIndicator = { comparable: number; withinLimit: number };

/** Atalhos para concluir registros (SPEC §5): rascunhos abertos e lotes que aguardam resultado. */
export type PendingItems = {
  drafts: { analysisId: string; version: number; lotId: string; lotLabel: string; updatedAt: Date; canFix: boolean }[];
  draftsTotal: number;
  fixableDraftsTotal: number;
  /** `toConfirm`: lote ligado a anúncio com desfecho ambíguo (etapa 4). */
  awaitingResult: { lotId: string; lotLabel: string; auctionName: string; startsAt: Date; toConfirm: boolean }[];
  awaitingResultTotal: number;
};
