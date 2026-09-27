import type { Bps, Cents } from "../money";
import type { ListingCondition } from "./condition";

/** Desfecho do anúncio na fonte. `unknown`: encerrado sem desfecho reconhecido (nunca adivinhado). */
export const LISTING_STATUSES = ["open", "sold", "conditional", "unsold", "withdrawn", "unknown"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/**
 * Anúncio no formato único do sistema (docs/PLANO-COLETA.md §1). Todo adaptador de fonte produz este tipo;
 * campos que a fonte não informa ficam `null`, nunca inventados.
 */
export type ListingInput = {
  externalId: string;
  url: string;
  lotNumber: string | null;
  title: string;
  vehicle: {
    brand: string | null;
    model: string | null;
    fipeCode: string | null;
    fipeName: string | null;
    modelYear: number | null;
    manufactureYear: number | null;
    mileageKm: number | null;
    fuel: string | null;
    color: string | null;
    category: string | null;
    recoveryType: string | null;
    hasKey: boolean | null;
  };
  auction: { externalId: string | null; name: string | null; startsAt: Date | null };
  sellerName: string | null;
  /** Texto do leiloeiro sobre o lote, sem HTML. */
  description: string | null;
  /** Dano, marcações e laudo cautelar: só o que a fonte declara (`condition.ts`). */
  condition: ListingCondition;
  startsAt: Date | null;
  endsAt: Date | null;
  location: { yardName: string | null; city: string | null; state: string | null; address: string | null };
  status: ListingStatus;
  /** Situação como a fonte escreve, para auditar o mapeamento. */
  sourceStatus: string | null;
  currentBid: Cents | null;
  minimumBid: Cents | null;
  bidCount: number | null;
  /** Valor de mercado informado pela fonte: referência rotulada (D-30). */
  marketValue: Cents | null;
  costs: {
    commissionRate: Bps | null;
    dispatcherFee: Cents | null;
    removalFee: Cents | null;
    storageFee: Cents | null;
    inspectionFee: Cents | null;
    otherFees: Cents | null;
  };
  photoUrls: string[];
  /** Dado original da fonte, já sem informações de quem deu lance. */
  raw: unknown;
};

/** Desfecho que não muda mais: o anúncio não precisa ser revisitado. */
export function isFinalStatus(status: ListingStatus): boolean {
  return status === "sold" || status === "unsold" || status === "withdrawn";
}
