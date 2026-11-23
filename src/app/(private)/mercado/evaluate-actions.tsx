import { Search } from "lucide-react";

import { ButtonLink } from "@/components/ui";
import type { EvaluateFilters } from "@/domain/research/evaluate";
import { CATALOG_LISTINGS_PATH, withQuery } from "@/features/listings/search";
import { evaluateCatalogParams } from "@/features/research/catalog-link";
import { SaveWatchButton } from "@/features/watches/components/save-watch-button";

/**
 * Do recorte avaliado para o que fazer com ele: ver os lotes abertos no catálogo ou criar um monitor que avisa quando
 * aparecer outro (modelo ou família, condição, ano, km e origem). Sem modelo, nada.
 */
export function EvaluateActions({ filters }: { filters: EvaluateFilters }) {
  const params = evaluateCatalogParams(filters);
  if (params === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonLink href={withQuery(CATALOG_LISTINGS_PATH, params)} variant="secondary" size="sm">
        <Search aria-hidden="true" />
        Ver no catálogo
      </ButtonLink>
      <SaveWatchButton query={new URLSearchParams(params).toString()} label="Acompanhar este veículo" size="sm" />
    </div>
  );
}
