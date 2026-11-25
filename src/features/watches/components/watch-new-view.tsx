import { FreshOnNavigation } from "@/components/layout/fresh-on-navigation";
import { Skeleton } from "@/components/ui";
import { listActiveSources } from "@/features/listings/queries";
import { getUserPreferences } from "@/features/preferences/queries";
import type { SearchParams } from "@/lib/catalog-search";
import { parseListingParams } from "@/lib/listing-filters";

import { createWatchAction } from "../actions";
import { WatchForm } from "./watch-form";

/**
 * Formulário de monitor novo. Com filtros na URL ("Salvar como monitor" em Leilões), já vem com os mesmos critérios.
 * Lê `searchParams` e a sessão: renderizar dentro de <Suspense>.
 */
export async function WatchNewView({ searchParams }: { searchParams: SearchParams }) {
  const [raw, sources, { region }] = await Promise.all([searchParams, listActiveSources(), getUserPreferences()]);
  const initialCriteria = Object.keys(raw).length > 0 ? parseListingParams(raw).criteria : undefined;

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
