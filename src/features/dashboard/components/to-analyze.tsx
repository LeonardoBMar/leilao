import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { DEFAULT_RADIUS_KM } from "@/domain/listings/criteria";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { DismissListingButton } from "@/features/listings/components/dismiss-listing-button";
import { ListingCard } from "@/features/listings/components/listing-card";
import { getRegionOverview } from "@/features/listings/queries";
import { CATALOG_LISTINGS_PATH } from "@/features/listings/search";

import { ToAnalyzeList } from "./to-analyze-list";

const INITIAL_SHOWN = 6;

/**
 * "Para analisar agora" (D-44, DESIGN.md §15.1): anúncios da região ou dos monitores cujo provável cabe no limite,
 * em cartões. A explicação da regra fica visível, porque o número é uma estimativa.
 */
export async function ToAnalyze() {
  const region = await getRegionOverview();

  if (region.toAnalyzeTotal === 0) {
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

  const rows = region.toAnalyze.map((item) => (
    <li key={item.id} className="flex border-t border-border pt-5 first:border-t-0 first:pt-0">
      <ListingCard item={item} compact footer={<DismissListingButton listingId={item.id} />} />
    </li>
  ));
  const beyondLoaded = Math.max(0, region.toAnalyzeTotal - region.toAnalyze.length);

  return (
    <div className="grid gap-5">
      <p
        className="text-caption text-muted"
        title={`Lotes abertos até ${DEFAULT_RADIUS_KM} km de ${DEFAULT_REGION.label} (carros, motos e utilitários) ou dos seus monitores, ainda fora das suas análises. Primeiro os estimados por vendas parecidas, depois os que encerram antes.`}
      >
        Da região ou dos seus monitores, com o provável lance final dentro do limite.
      </p>
      <ToAnalyzeList
        initial={rows.slice(0, INITIAL_SHOWN)}
        extra={rows.slice(INITIAL_SHOWN)}
        beyondLoaded={beyondLoaded}
      />
    </div>
  );
}

export function ToAnalyzeSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden="true">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
