import type { ListingCriteria } from "@/domain/listings/criteria";

/** Monitor como a UI usa: critérios já no formato do domínio. */
export type WatchItem = {
  id: string;
  name: string | null;
  criteria: ListingCriteria;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WatchListItem = WatchItem & {
  /** Critérios em uma linha, com o nome das fontes. */
  description: string;
  /** Anúncios abertos que atendem aos critérios agora (não geram alerta; ver `alertsFrom`). */
  openMatches: number;
  unreadAlerts: number;
};
