import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { DismissListingButton } from "@/features/listings/components/dismiss-listing-button";
import { ListingCard } from "@/features/listings/components/listing-card";
import { getRegionOverview } from "@/features/listings/queries";
import { CATALOG_LISTINGS_PATH } from "@/features/listings/search";

/**
 * "Para analisar agora" (D-44, DESIGN.md §15.1): os 4 melhores anúncios da região ou dos monitores cujo provável
 * cabe no limite, em cartões.
 */
export async function ToAnalyze() {
  const region = await getRegionOverview();

  if (region.toAnalyze.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhum lote da região cabe no limite agora"
        description="Aparecem aqui os lotes abertos do filtro padrão ou dos seus monitores cujo provável lance final cabe no limite."
        action={
          <ButtonLink href={CATALOG_LISTINGS_PATH} variant="secondary">
            Abrir o catálogo
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="grid gap-5">
      {region.toAnalyze.map((item) => (
        <li key={item.id} className="flex border-t border-border pt-5 first:border-t-0 first:pt-0">
          <ListingCard item={item} compact footer={<DismissListingButton listingId={item.id} />} />
        </li>
      ))}
    </ul>
  );
}

export function ToAnalyzeSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden="true">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
