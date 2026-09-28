import { Radar } from "lucide-react";

import { ListPagination } from "@/components/layout/list-pagination";
import { Alert, AlertDescription, EmptyState, Skeleton } from "@/components/ui";
import { DEFAULT_CATEGORY, DEFAULT_CONDITION } from "@/domain/listings/criteria";

import { listListings } from "../queries";
import { DEFAULT_DISTANCE, type ListingFilters as Filters, listingFiltersSchema } from "../schemas";
import { ListingCard } from "./listing-card";
import { ListingFilters, type ListingFilterValues } from "./listing-filters";

/** Cards na primeira linha no layout mais largo (3 colunas). */
const FIRST_ROW = 3;

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
    categoria: filters.category,
    condicao: filters.condition,
    situacao: filters.ended ? "encerrados" : "abertos",
  };

  return (
    <div className="grid gap-6">
      <ListingFilters values={values} />
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
    categoria: values.categoria === DEFAULT_CATEGORY ? undefined : values.categoria,
    condicao: values.condicao === DEFAULT_CONDITION ? undefined : values.condicao,
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
        {page.items.map((item, index) => (
          <li key={item.id}>
            <ListingCard item={item} eager={index < FIRST_ROW} />
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
