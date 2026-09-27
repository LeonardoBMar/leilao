import { Archive, Gavel, SearchX } from "lucide-react";
import Link from "next/link";

import { ListPagination } from "@/components/layout/list-pagination";
import {
  Badge,
  Button,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import { ORIGIN_LABELS, STATUS_BADGE_VARIANTS, STATUS_LABELS } from "../labels";
import { listAuctions } from "../queries";
import { type AuctionFilters, auctionFiltersSchema } from "../schemas";
import type { AuctionListItem } from "../types";
import { AuctionFilters as AuctionFiltersBar, type AuctionFilterValues } from "./auction-filters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Lê os filtros da URL, mostra a barra de filtros e a lista. Renderizar dentro de <Suspense>. */
export async function AuctionsView({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const filters = auctionFiltersSchema.parse(firstValues(raw));
  const values = toFilterValues(filters);

  return (
    <div className="grid gap-6">
      <AuctionFiltersBar values={values} />
      <AuctionList filters={filters} params={toUrlParams(values)} />
    </div>
  );
}

async function AuctionList({
  filters,
  params,
}: {
  filters: AuctionFilters;
  params: Record<string, string | undefined>;
}) {
  const result = await listAuctions(filters);
  const hasFilters = Boolean(filters.search || filters.origin || filters.status || filters.from || filters.to);

  if (result.total === 0) {
    if (filters.archived) {
      return (
        <EmptyState icon={Archive} title="Nenhum leilão arquivado" description="Leilões arquivados aparecem aqui." />
      );
    }
    return hasFilters ? (
      <EmptyState icon={SearchX} title="Nenhum leilão encontrado" description="Ajuste a busca ou limpe os filtros." />
    ) : (
      <EmptyState
        icon={Gavel}
        title="Nenhum leilão cadastrado"
        description="Cadastre o primeiro leilão para começar a acompanhar lotes."
        action={
          <Button asChild>
            <Link href="/leiloes/novo">Cadastrar leilão</Link>
          </Button>
        }
      />
    );
  }

  return (
    <section aria-label="Leilões" className="grid gap-4">
      {/* Mobile: linhas empilhadas. */}
      <ul className="grid gap-3 md:hidden">
        {result.items.map((auction) => (
          <li key={auction.id} className="rounded-lg border border-border bg-surface p-4">
            <Link href={`/leiloes/${auction.id}`} className="text-body font-semibold text-primary hover:underline">
              {auction.name}
            </Link>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
              <MobileField label="Data">{formatDateTime(auction.startsAt)}</MobileField>
              <MobileField label="Organizador">{auction.auctioneer}</MobileField>
              <MobileField label="Origem">{ORIGIN_LABELS[auction.origin]}</MobileField>
              <MobileField label="Lotes">{auction.lotCount}</MobileField>
            </dl>
            <div className="mt-3">
              <StatusBadge auction={auction} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet e desktop: tabela. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Organizador</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lotes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((auction) => (
              <TableRow key={auction.id}>
                <TableCell className="font-semibold">
                  <Link href={`/leiloes/${auction.id}`} className="text-primary hover:underline">
                    {auction.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(auction.startsAt)}</TableCell>
                <TableCell>{auction.auctioneer}</TableCell>
                <TableCell>{ORIGIN_LABELS[auction.origin]}</TableCell>
                <TableCell>
                  <StatusBadge auction={auction} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{auction.lotCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ListPagination
        basePath="/leiloes"
        params={params}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </section>
  );
}

function StatusBadge({ auction }: { auction: AuctionListItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant={STATUS_BADGE_VARIANTS[auction.status]}>{STATUS_LABELS[auction.status]}</Badge>
      {auction.archivedAt ? <Badge variant="outline">Arquivado</Badge> : null}
    </span>
  );
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-foreground">{children}</dd>
    </div>
  );
}

export function AuctionsViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-40" />
      <Skeleton className="h-96" />
    </div>
  );
}

function firstValues(raw: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

function toFilterValues(filters: AuctionFilters): AuctionFilterValues {
  return {
    busca: filters.search,
    origem: filters.origin,
    status: filters.status,
    de: filters.from,
    ate: filters.to,
    ordem: filters.sort,
    arquivados: filters.archived,
  };
}

function toUrlParams(values: AuctionFilterValues): Record<string, string | undefined> {
  return {
    busca: values.busca,
    origem: values.origem,
    status: values.status,
    de: values.de,
    ate: values.ate,
    ordem: values.ordem === "desc" ? "desc" : undefined,
    arquivados: values.arquivados ? "1" : undefined,
  };
}
