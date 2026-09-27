import { ExternalLink, MapPin, Radar } from "lucide-react";
import Image from "next/image";

import { ListPagination } from "@/components/layout/list-pagination";
import { Alert, AlertDescription, Badge, EmptyState, Money, Skeleton } from "@/components/ui";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { formatDateTime, formatKm } from "@/lib/format";

import { LISTING_STATUS_LABELS, LISTING_STATUS_VARIANTS } from "../labels";
import { listListings } from "../queries";
import { DEFAULT_DISTANCE, type ListingFilters as Filters, listingFiltersSchema } from "../schemas";
import type { ListingListItem } from "../types";
import { ListingFilters, type ListingFilterValues } from "./listing-filters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** "Descobertos": anúncios coletados, com filtros na URL. Renderizar dentro de <Suspense>. */
export async function ListingsView({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const first = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const filters = listingFiltersSchema.parse(Object.fromEntries(Object.keys(raw).map((key) => [key, first(key)])));
  const values: ListingFilterValues = {
    busca: filters.search,
    anoDe: filters.yearFrom?.toString(),
    anoAte: filters.yearTo?.toString(),
    precoAte: filters.maxPrice === undefined ? undefined : String(filters.maxPrice / 100),
    distancia: filters.distanceKm === null ? "todas" : String(filters.distanceKm),
    situacao: filters.ended ? "encerrados" : "abertos",
  };

  return (
    <div className="grid gap-6">
      <ListingFilters values={values} regionLabel={DEFAULT_REGION.label} />
      <ListingList filters={filters} values={values} />
    </div>
  );
}

async function ListingList({ filters, values }: { filters: Filters; values: ListingFilterValues }) {
  const page = await listListings(filters);

  if (page.total === 0) {
    return (
      <EmptyState
        icon={Radar}
        title={filters.ended ? "Nenhum lote encerrado encontrado" : "Nenhum lote aberto encontrado"}
        description="O coletor busca lotes novos a cada 2 horas. Ajuste a distância ou limpe os filtros."
      />
    );
  }

  const params: Record<string, string | undefined> = {
    busca: values.busca,
    anoDe: values.anoDe,
    anoAte: values.anoAte,
    precoAte: values.precoAte,
    distancia: values.distancia === DEFAULT_DISTANCE ? undefined : values.distancia,
    situacao: values.situacao === "abertos" ? undefined : values.situacao,
  };

  return (
    <section aria-label="Lotes descobertos" className="grid gap-4">
      {page.truncated ? (
        <Alert variant="info">
          <AlertDescription>
            Muitos lotes para esta busca: mostrando só os primeiros. Refine a busca, o ano ou o preço para ver todos.
          </AlertDescription>
        </Alert>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {page.items.map((item) => (
          <li key={item.id}>
            <ListingCard item={item} />
          </li>
        ))}
      </ul>
      <ListPagination
        basePath="/descobertos"
        params={params}
        page={page.page}
        pageSize={page.pageSize}
        total={page.total}
      />
    </section>
  );
}

function ListingCard({ item }: { item: ListingListItem }) {
  const isOpen = item.status === "open";
  const bid = isOpen ? item.currentBid : item.finalBid;

  return (
    <article className="grid h-full content-start overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative aspect-4/3 bg-surface-subtle">
        {item.photoUrl ? (
          // Foto direto da fonte (D-29): sem otimização do Next, que baixaria e guardaria a imagem.
          <Image
            src={item.photoUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : null}
        <Badge variant={LISTING_STATUS_VARIANTS[item.status]} className="absolute top-2 left-2">
          {LISTING_STATUS_LABELS[item.status]}
        </Badge>
      </div>

      <div className="grid gap-3 p-4">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-foreground">
            {item.title}
            {item.modelYear ? ` ${item.modelYear}` : ""}
          </h3>
          <p className="text-caption text-muted">
            {[item.mileageKm === null ? null : formatKm(item.mileageKm), item.fuel, item.recoveryType]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <p className="flex items-center gap-1 text-caption text-foreground-secondary">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {item.city && item.state ? `${item.city}/${item.state}` : "Local não informado"}
          {item.distanceKm === null ? null : ` · ${Math.round(item.distanceKm)} km`}
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
          <dt className="text-muted">{isOpen ? (item.currentBid ? "Lance atual" : "Lance inicial") : "Lance final"}</dt>
          <dd className="text-right font-semibold text-foreground">
            <Money value={isOpen ? (bid ?? item.minimumBid) : bid} />
          </dd>
          <dt className="text-muted">Mercado ({item.sourceName})</dt>
          <dd className="text-right">
            <Money value={item.marketValue} />
          </dd>
          <dt className="text-muted">{isOpen ? "Encerra" : "Encerrou"}</dt>
          <dd className="text-right tabular-nums">{item.endsAt ? formatDateTime(item.endsAt) : "—"}</dd>
        </dl>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-caption text-primary hover:underline"
        >
          Ver lote {item.lotNumber ?? ""} no {item.sourceName}
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </div>
    </article>
  );
}

export function ListingsViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-40" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
