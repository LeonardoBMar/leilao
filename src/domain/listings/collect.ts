import type { Cents } from "../money";
import type { ListingInput, ListingStatus } from "./types";

/**
 * Lance final: o último lance de um anúncio já encerrado. Base das estimativas (D-28);
 * o desfecho (`status`) diz se virou venda.
 */
export function finalBidOf(listing: Pick<ListingInput, "status" | "currentBid">): Cents | null {
  return listing.status === "open" ? null : listing.currentBid;
}

type Snapshot = { status: ListingStatus; bidCents: number | null; bidCount: number | null };

/** Só grava observação quando algo mudou: o histórico fica com os pontos de mudança, sem repetição. */
export function observationChanged(previous: Snapshot | null, next: Snapshot): boolean {
  return (
    previous === null ||
    previous.status !== next.status ||
    previous.bidCents !== next.bidCents ||
    previous.bidCount !== next.bidCount
  );
}

export type Visit = { externalId: string; url: string; reason: "due" | "new" };

/**
 * Ordem das visitas de uma execução, dentro do limite de requisições:
 * 1. revisitas vencidas, da mais antiga (gravar arremates antes que a página saia do ar);
 * 2. anúncios novos do sitemap.
 * O que não couber fica para a próxima execução: o anúncio novo continua no sitemap, a revisita continua vencida.
 */
export function planVisits(input: {
  due: readonly { externalId: string; url: string }[];
  discovered: readonly { externalId: string; url: string }[];
  knownIds: ReadonlySet<string>;
  budget: number;
}): Visit[] {
  const visits: Visit[] = [];
  const planned = new Set<string>();
  const add = (item: { externalId: string; url: string }, reason: Visit["reason"]) => {
    if (visits.length >= input.budget || planned.has(item.externalId)) return;
    planned.add(item.externalId);
    visits.push({ externalId: item.externalId, url: item.url, reason });
  };
  for (const item of input.due) add(item, "due");
  for (const item of input.discovered) if (!input.knownIds.has(item.externalId)) add(item, "new");
  return visits;
}
