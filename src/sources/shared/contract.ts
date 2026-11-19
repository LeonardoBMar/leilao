import { LISTING_STATUSES, type ListingInput, toListingCategory } from "@/domain/listings/types";
import { MAX_BPS, MAX_CENTS } from "@/domain/money";

import { LISTING_IMAGE_ORIGINS } from "../image-origins";

const MIN_VEHICLE_YEAR = 1900;
const MAX_VEHICLE_YEAR = 2100;

/**
 * Regras que todo anúncio precisa cumprir, venha de qual fonte vier (D-37). O coletor confere antes de gravar
 * (anúncio com problema vira falha da execução, não dado errado no catálogo) e o teste de cada adaptador também.
 * Devolve a lista de problemas; vazia quando está tudo certo.
 */
export function listingContractProblems(
  listing: ListingInput,
  expected: { externalId: string; url: string },
): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, problem: string) => {
    if (!ok) problems.push(problem);
  };

  check(listing.externalId === expected.externalId, `página de outro anúncio (${listing.externalId})`);
  check(listing.url === expected.url, "URL diferente da canônica");
  check(listing.title.trim() !== "", "sem título");
  check(LISTING_STATUSES.includes(listing.status), `situação inválida (${listing.status})`);
  check(
    listing.vehicle.category === null || toListingCategory(listing.vehicle.category) !== null,
    `categoria fora do vocabulário comum (${listing.vehicle.category})`,
  );
  for (const [field, value] of moneyFields(listing)) {
    check(
      value === null || (Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS),
      `${field} fora da faixa de centavos`,
    );
  }
  const { commissionRate } = listing.costs;
  check(
    commissionRate === null || (Number.isInteger(commissionRate) && commissionRate >= 0 && commissionRate <= MAX_BPS),
    "comissão fora da faixa (0..10.000 bps)",
  );
  const { mileageKm, modelYear, manufactureYear } = listing.vehicle;
  check(
    mileageKm === null || (Number.isInteger(mileageKm) && mileageKm >= 0 && mileageKm <= MAX_CENTS),
    "quilometragem fora da faixa",
  );
  for (const [label, year] of [
    ["ano do modelo", modelYear],
    ["ano de fabricação", manufactureYear],
  ] as const) {
    check(
      year === null || (Number.isInteger(year) && year >= MIN_VEHICLE_YEAR && year <= MAX_VEHICLE_YEAR),
      `${label} inválido (${year})`,
    );
  }
  check(listing.bidCount === null || (Number.isInteger(listing.bidCount) && listing.bidCount >= 0), "nº de lances");
  check(listing.currentBid === null || listing.bidCount !== 0, "lance atual sem nenhum lance");
  for (const date of [listing.startsAt, listing.endsAt, listing.auction.startsAt]) {
    check(date === null || !Number.isNaN(date.getTime()), "data inválida");
  }
  check(
    listing.photoUrls.every((url) => LISTING_IMAGE_ORIGINS.some((origin) => url.startsWith(`${origin}/`))),
    "foto fora das origens liberadas na CSP (image-origins.ts)",
  );
  return problems;
}

function moneyFields(listing: ListingInput): [string, number | null][] {
  return [
    ["lance atual", listing.currentBid],
    ["lance mínimo", listing.minimumBid],
    ["valor de mercado", listing.marketValue],
    ["despachante", listing.costs.dispatcherFee],
    ["remoção", listing.costs.removalFee],
    ["depósito", listing.costs.storageFee],
    ["vistoria", listing.costs.inspectionFee],
    ["outras taxas", listing.costs.otherFees],
  ];
}
