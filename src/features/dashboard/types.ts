/** Contagens dos cards do dashboard (SPEC §5 `/dashboard`). */
export type DashboardSummary = {
  activeAuctions: number;
  activeLots: number;
  followedLotsWithoutResult: number;
  analyzedLots: number;
};
