import type { ListingListItem } from "@/features/listings/types";

/** Alerta como a UI usa: o anúncio com os dados atuais e o monitor que o encontrou. */
export type AlertItem = {
  id: string;
  createdAt: Date;
  readAt: Date | null;
  watchId: string;
  watchTitle: string;
  listing: ListingListItem;
};

export type AlertPage = {
  items: AlertItem[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
  /** Monitor do filtro, quando há um. */
  watchTitle: string | null;
};
