import { type ListingCriteria, type MatchableListing, matchesCriteria } from "./criteria";

/**
 * Quais anúncios viram alerta para quais monitores (docs/PLANO-COLETA.md, etapa 2):
 * - só anúncios vistos pela primeira vez depois de `alertsFrom` do monitor (o que já existia não vira alerta);
 * - só dentro da janela `ALERT_LOOKBACK_MS`: se uma execução falhar, a seguinte recupera, sem varrer o catálogo todo;
 * - um alerta por par monitor × anúncio; o banco ignora o par repetido, então mudança no anúncio não gera outro.
 */
export const ALERT_LOOKBACK_MS = 48 * 60 * 60 * 1000;

export type AlertWatch = { id: string; ownerId: string; alertsFrom: Date; criteria: ListingCriteria };
export type AlertCandidate = MatchableListing & { id: string; firstSeenAt: Date };
export type PlannedAlert = { ownerId: string; watchId: string; listingId: string };

/** Anúncios vistos a partir daqui podem gerar alerta nesta execução. `null`: nenhum monitor ligado. */
export function alertWindowStart(watches: readonly Pick<AlertWatch, "alertsFrom">[], now: Date): Date | null {
  if (watches.length === 0) return null;
  const oldest = Math.min(...watches.map((watch) => watch.alertsFrom.getTime()));
  return new Date(Math.max(oldest, now.getTime() - ALERT_LOOKBACK_MS));
}

export function planAlerts(
  watches: readonly AlertWatch[],
  listings: readonly AlertCandidate[],
  now: Date,
): PlannedAlert[] {
  const windowStart = now.getTime() - ALERT_LOOKBACK_MS;
  return watches.flatMap((watch) =>
    listings
      .filter(
        (listing) =>
          listing.firstSeenAt >= watch.alertsFrom &&
          listing.firstSeenAt.getTime() >= windowStart &&
          matchesCriteria(watch.criteria, listing, now),
      )
      .map((listing) => ({ ownerId: watch.ownerId, watchId: watch.id, listingId: listing.id })),
  );
}
