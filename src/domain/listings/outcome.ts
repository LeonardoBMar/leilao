import type { Cents } from "../money";
import type { ListingStatus } from "./types";

/**
 * Resultado automático (docs/PLANO-COLETA.md, etapa 4): o que o desfecho do anúncio ligado significa para o lote do
 * usuário. Só desfecho inequívoco vira resultado sozinho; o ambíguo fica "a confirmar", já preenchido.
 */
export type ListingOutcome =
  /** Ainda em andamento, ou encerrado com o coletor ainda revisitando: espera. */
  | { kind: "pending" }
  /** Desfecho definitivo na fonte: o coletor registra o resultado. */
  | { kind: "final"; outcome: "sold" | "unsold" | "withdrawn"; finalBid: Cents | null; eventAt: Date | null }
  /**
   * Condicional (lance à espera do vendedor) ou desfecho desconhecido (página saiu do ar, coletor desistiu):
   * o usuário confirma, a partir do último lance visto.
   */
  | { kind: "to_confirm"; reason: "conditional" | "unknown"; lastBid: Cents | null; eventAt: Date | null };

export type OutcomeListing = {
  status: ListingStatus;
  currentBid: Cents | null;
  finalBid: Cents | null;
  endsAt: Date | null;
  /** O coletor ainda vai revisitar (`next_check_at` preenchido). */
  checking: boolean;
};

export function listingOutcome(listing: OutcomeListing, now: Date): ListingOutcome {
  // O catálogo aceita lance zero; resultado arrematado exige preço positivo (CHECK de results).
  const lastBid = positive(listing.finalBid) ?? positive(listing.currentBid);
  const eventAt = listing.endsAt !== null && listing.endsAt <= now ? listing.endsAt : null;

  switch (listing.status) {
    case "sold":
      return { kind: "final", outcome: "sold", finalBid: lastBid, eventAt };
    case "unsold":
    case "withdrawn":
      return { kind: "final", outcome: listing.status, finalBid: null, eventAt };
    case "conditional":
      return { kind: "to_confirm", reason: "conditional", lastBid, eventAt };
    case "unknown":
      return { kind: "to_confirm", reason: "unknown", lastBid, eventAt };
    case "open":
      // Sem revisita marcada, depois do fim ou sem data de fim: o coletor desistiu e não virá desfecho.
      if (!listing.checking && (eventAt !== null || listing.endsAt === null)) {
        return { kind: "to_confirm", reason: "unknown", lastBid, eventAt };
      }
      return { kind: "pending" };
  }
}

/** Anúncio encerrado ao adicionar ao Tracker: a análise nasce conhecendo o resultado (SPEC §10). */
export function hasEnded(listing: Pick<OutcomeListing, "status" | "endsAt">, now: Date): boolean {
  return listing.status !== "open" || (listing.endsAt !== null && listing.endsAt <= now);
}

function positive(value: Cents | null): Cents | null {
  return value !== null && value > 0 ? value : null;
}
