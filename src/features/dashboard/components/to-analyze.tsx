import Link from "next/link";

import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { DEFAULT_RADIUS_KM } from "@/domain/listings/criteria";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { DismissListingButton } from "@/features/listings/components/dismiss-listing-button";
import { ListingCard } from "@/features/listings/components/listing-card";
import { getRegionOverview } from "@/features/listings/queries";
import { CATALOG_LISTINGS_PATH, withQuery } from "@/features/listings/search";

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
      <p
        className="text-caption text-muted"
        title={`Lotes abertos até ${DEFAULT_RADIUS_KM} km de ${DEFAULT_REGION.label} (carros, motos e utilitários) ou dos seus monitores, ainda fora das suas análises. Primeiro os estimados por vendas parecidas, depois os que encerram antes.`}
      >
        Da região ou dos seus monitores, com o provável lance final dentro do limite.
      </p>
      <ul className="grid gap-5">
        {region.toAnalyze.map((item) => (
          <li key={item.id} className="flex border-t border-border pt-5 first:border-t-0 first:pt-0">
            <ListingCard item={item} compact footer={<DismissListingButton listingId={item.id} />} />
          </li>
        ))}
      </ul>
      {more > 0 ? (
        // O catálogo não filtra "cabe no limite" nem soma os monitores: leva ao filtro padrão sem os já analisados.
        <Link
          href={withQuery(CATALOG_LISTINGS_PATH, { analisados: "esconder" })}
          className="w-fit text-label text-accent hover:underline"
        >
          E mais {more} {more === 1 ? "lote" : "lotes"} · Ver no catálogo
        </Link>
      ) : null}
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
