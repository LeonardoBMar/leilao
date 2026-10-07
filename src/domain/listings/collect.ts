import type { Cents } from "../money";
import type { ListingInput, ListingStatus } from "./types";

/**
 * Lance final: o último lance de um anúncio já encerrado. Base das estimativas (D-28);
 * o desfecho (`status`) diz se virou venda.
 */
export function finalBidOf(listing: Pick<ListingInput, "status" | "currentBid">): Cents | null {
  return listing.status === "open" ? null : listing.currentBid;
}

/**
 * A página do anúncio sumiu (HTTP 404 ou redireciona para outro anúncio). É definitivo quando o anúncio já encerrou ou
 * já saiu do sitemap (a lista de disponíveis da fonte): o Leilo tira do ar lotes encerrados sem venda (ex.: condicional
 * negada), republica com outro id os que voltam a leilão e tira lotes sem data de fim que deixam de ser oferecidos. Devolve a situação a gravar, sem revisita: aberto vira desconhecido (não se
 * adivinha o desfecho), o resto fica como estava. Ainda no sitemap e antes do fim, `null`: pode ser instabilidade,
 * e conta como falha. `sitemapReadAt` nulo (sitemap não carregou) nunca conclui "saiu do sitemap".
 */
export function goneStatus(
  listing: { status: ListingStatus; endsAt: Date | null; lastSeenAt: Date },
  now: Date,
  sitemapReadAt: Date | null,
): ListingStatus | null {
  const ended = listing.endsAt !== null && listing.endsAt <= now;
  const delisted = sitemapReadAt !== null && listing.lastSeenAt < sitemapReadAt;
  if (!ended && !delisted) return null;
  return listing.status === "open" ? "unknown" : listing.status;
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
