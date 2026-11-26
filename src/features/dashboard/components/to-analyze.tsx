import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { DismissListingButton } from "@/features/listings/components/dismiss-listing-button";
import { DismissedListingsDialog } from "@/features/listings/components/dismissed-listings-dialog";
import { ListingCard } from "@/features/listings/components/listing-card";
import { getRegionOverview } from "@/features/listings/queries";
import { getUserPreferences } from "@/features/preferences/queries";
import { CATALOG_LISTINGS_PATH, withQuery } from "@/lib/catalog-search";

/**
 * "Para analisar agora" (D-44, DESIGN.md §15.1): os melhores anúncios da região ou dos monitores cujo provável
 * cabe no limite, com link para ver os demais no catálogo.
 */
export async function ToAnalyze() {
  const [overview, { region }] = await Promise.all([getRegionOverview(), getUserPreferences()]);

  if (overview.toAnalyze.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhum lote da região cabe no limite agora"
        description={
          <>
            Aparecem aqui os lotes abertos da{" "}
            <Link
              href="/sistema/preferencias"
              className="rounded-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent"
            >
              sua região-base
            </Link>{" "}
            (até {region.radiusKm} km de {region.label}) ou dos{" "}
            <Link
              href="/monitores"
              className="rounded-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent"
            >
              seus monitores
            </Link>{" "}
            cujo preço provável cabe no limite estimado.
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={CATALOG_LISTINGS_PATH} variant="secondary" size="sm">
              Ver todos os veículos
            </ButtonLink>
            <DismissedListingsDialog items={overview.dismissed} />
          </div>
        }
      />
    );
  }

  const remaining = overview.toAnalyzeTotal - overview.toAnalyze.length;

  return (
    <div className="@container grid gap-4">
      <ul role="list" className="grid grid-cols-1 gap-5 @3xl:grid-cols-2 @3xl:gap-x-8 @3xl:gap-y-6">
        {overview.toAnalyze.map((item) => (
          <li
            key={item.id}
            className="flex border-t border-border pt-5 first:border-t-0 first:pt-0 @3xl:border-t-0 @3xl:pt-0"
          >
            <ListingCard item={item} compact footer={<DismissListingButton listingId={item.id} />} />
          </li>
        ))}
      </ul>
      {overview.truncated ? (
        <p className="text-caption text-muted">
          Mostrando os primeiros resultados do filtro — há mais lotes abertos na região.
        </p>
      ) : null}
      {remaining > 0 || overview.dismissed.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {remaining > 0 ? (
            <ButtonLink
              href={withQuery(CATALOG_LISTINGS_PATH, { analisados: "esconder" })}
              variant="secondary"
              size="sm"
              className="w-fit"
            >
              Ver mais {remaining} no catálogo
              <ChevronRight aria-hidden="true" />
            </ButtonLink>
          ) : null}
          <DismissedListingsDialog items={overview.dismissed} />
        </div>
      ) : null}
    </div>
  );
}

export function ToAnalyzeSkeleton() {
  return (
    <div className="@container" aria-hidden="true">
      <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-2 @3xl:gap-x-8">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}
