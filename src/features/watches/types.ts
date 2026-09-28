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
  /** Anúncios abertos que atendem aos critérios agora (não geram alerta; ver `alertsFrom`). */
  openMatches: number;
  /** Mais candidatos que o teto da busca por raio: o número é parcial. */
  openMatchesTruncated: boolean;
  unreadAlerts: number;
};
