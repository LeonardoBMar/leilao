import { Search } from "lucide-react";

import { ButtonLink } from "@/components/ui";
import type { ResearchFilters } from "@/domain/research/filters";
import { CATALOG_LISTINGS_PATH, withQuery } from "@/features/listings/search";
import { catalogParams } from "@/features/research/catalog-link";
import { SaveWatchButton } from "@/features/watches/components/save-watch-button";

/**
 * Do modelo pesquisado para o que fazer com ele (D-45): ver os lotes abertos dele no catálogo ou criar um monitor que
 * avisa quando aparecer outro. Os dois levam a condição, a categoria e a faixa de ano do filtro. Sem modelo, nada.
 */
export function ModelCatalogActions({ filters }: { filters: ResearchFilters }) {
  const params = catalogParams(filters);
  if (params === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonLink href={withQuery(CATALOG_LISTINGS_PATH, params)} variant="secondary" size="sm">
        <Search aria-hidden="true" />
        Ver lotes abertos deste modelo
      </ButtonLink>
      <SaveWatchButton query={new URLSearchParams(params).toString()} label="Acompanhar este modelo" size="sm" />
    </div>
  );
}
