import { CONDITION_RULES, DEFAULT_CATEGORY, type ListingCriteria } from "@/domain/listings/criteria";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/features/listings/schemas";
import { formatBRL } from "@/lib/format";

/** Critérios em uma linha legível: "VW Fox · 2011–2013 · até R$ 25.000,00 · até 150 km · até pequena monta". */
export function describeCriteria(criteria: ListingCriteria): string {
  const { search, yearFrom, yearTo, maxPrice, radiusKm, category, condition } = criteria;
  const years =
    yearFrom !== null && yearTo !== null
      ? yearFrom === yearTo
        ? String(yearFrom)
        : `${yearFrom}–${yearTo}`
      : yearFrom !== null
        ? `a partir de ${yearFrom}`
        : yearTo !== null
          ? `até ${yearTo}`
          : null;

  return [
    search,
    years,
    maxPrice === null ? null : `até ${formatBRL(maxPrice)}`,
    radiusKm === null ? "qualquer distância" : `até ${radiusKm} km`,
    category === DEFAULT_CATEGORY ? null : CATEGORY_LABELS[category],
    CONDITION_RULES[condition] === null ? null : CONDITION_LABELS[condition].toLowerCase(),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Título do monitor: o nome dado ou, sem nome, a busca (ou os critérios). */
export function watchTitle(name: string | null, criteria: ListingCriteria): string {
  return name ?? criteria.search ?? describeCriteria(criteria);
}

/** Link para "Todos os veículos" com os mesmos critérios ("ver os que combinam agora"). */
export function discoveredHref(criteria: ListingCriteria): string {
  const params = new URLSearchParams();
  if (criteria.search) params.set("busca", criteria.search);
  if (criteria.yearFrom !== null) params.set("anoDe", String(criteria.yearFrom));
  if (criteria.yearTo !== null) params.set("anoAte", String(criteria.yearTo));
  if (criteria.maxPrice !== null) params.set("precoAte", String(Math.floor(criteria.maxPrice / 100)));
  params.set("distancia", criteria.radiusKm === null ? "todas" : String(criteria.radiusKm));
  params.set("categoria", criteria.category);
  params.set("condicao", criteria.condition);
  return `/leiloes/veiculos?${params.toString()}`;
}
