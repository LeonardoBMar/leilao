/** Contagens dos cards do dashboard (SPEC §5 `/dashboard`). */
export type DashboardSummary = {
  activeAuctions: number;
  activeLots: number;
  followedLotsWithoutResult: number;
  analyzedLots: number;
  /** Indicador inicial do SPEC §10: comparáveis com análise anterior e quantos ficaram dentro do limite. */
  indicator: { comparable: number; withinLimit: number };
};
