import { FreshOnNavigation } from "@/components/layout/fresh-on-navigation";
import { Skeleton } from "@/components/ui";
import { DEFAULT_CRITERIA, RADIUS_OPTIONS_KM } from "@/domain/listings/criteria";
import { listActiveSources } from "@/features/listings/queries";
import { getUserPreferences } from "@/features/preferences/queries";
import type { SearchParams } from "@/lib/catalog-search";
import { parseListingParams } from "@/lib/listing-filters";

import { createWatchAction } from "../actions";
import { WatchForm } from "./watch-form";

/** Ajusta o raio da preferência para a opção válida mais próxima do monitor (CHECK `watches_radius_option`). */
function watchRadiusOption(radiusKm: number | null): number | null {
  if (radiusKm === null) return null;
  return RADIUS_OPTIONS_KM.find((option) => option >= radiusKm) ?? null;
}

/**
 * Formulário de monitor novo. Com filtros na URL ("Salvar como monitor" em Leilões), já vem com os mesmos critérios.
 * Lê `searchParams` e a sessão: renderizar dentro de <Suspense>.
 */
export async function WatchNewView({ searchParams }: { searchParams: SearchParams }) {
  const [raw, sources, { region }] = await Promise.all([searchParams, listActiveSources(), getUserPreferences()]);
  const parsedCriteria =
    Object.keys(raw).length > 0 ? parseListingParams(raw, region.radiusKm).criteria : DEFAULT_CRITERIA;
  const initialCriteria = {
    ...parsedCriteria,
    radiusKm: watchRadiusOption(Object.keys(raw).length > 0 ? parsedCriteria.radiusKm : region.radiusKm),
  };

  return (
    <FreshOnNavigation>
      <WatchForm
        action={createWatchAction}
        initialCriteria={initialCriteria}
        sources={sources}
        regionLabel={region.label}
        currentYear={new Date().getUTCFullYear()}
        submitLabel="Criar monitor"
      />
    </FreshOnNavigation>
  );
}

export function WatchNewViewSkeleton() {
  return <Skeleton className="h-150 max-w-2xl" />;
}
