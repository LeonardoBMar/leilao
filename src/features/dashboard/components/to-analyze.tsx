import Link from "next/link";

import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { DEFAULT_RADIUS_KM } from "@/domain/listings/criteria";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { ListingCard } from "@/features/listings/components/listing-card";
import { getRegionOverview } from "@/features/listings/queries";
import { CATALOG_LISTINGS_PATH } from "@/features/listings/search";

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

  const more = region.toAnalyzeTotal - region.toAnalyze.length;
  return (
    <div className="grid gap-5">
      <p className="text-caption text-muted">
        Lotes abertos até {DEFAULT_RADIUS_KM} km de {DEFAULT_REGION.label} (carros, motos e utilitários) ou dos seus
        monitores, ainda fora das suas análises, cujo provável lance final cabe no limite. Primeiro os estimados por
        vendas parecidas, depois os que encerram antes.
      </p>
      <ul className="grid gap-x-7 gap-y-11 sm:grid-cols-2 2xl:grid-cols-3">
        {region.toAnalyze.map((item, index) => (
          <li key={item.id} className="flex">
            <ListingCard item={item} eager={index === 0} />
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <Link href={CATALOG_LISTINGS_PATH} className="w-fit text-label text-accent hover:underline">
          E mais {more} {more === 1 ? "lote" : "lotes"} · Ver no catálogo
        </Link>
      ) : null}
    </div>
  );
}

export function ToAnalyzeSkeleton() {
  return (
    <div className="grid gap-x-7 gap-y-11 sm:grid-cols-2 2xl:grid-cols-3" aria-hidden="true">
      <Skeleton className="h-96" />
      <Skeleton className="h-96" />
    </div>
  );
}
