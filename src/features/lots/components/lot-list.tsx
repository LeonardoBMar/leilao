import { Archive, Package, Plus, SearchX } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { ListPagination } from "@/components/layout/list-pagination";
import {
  Badge,
  ButtonLink,
  EmptyState,
  Money,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatDate } from "@/lib/format";

import { listLots } from "../queries";
import { type LotFilters, lotFiltersSchema } from "../schemas";
import type { LotListItem } from "../types";
import { LimitBadge } from "./limit-badge";
import { LotFilters as LotFiltersBar, type LotFilterValues } from "./lot-filters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type LotsViewProps = {
  searchParams: SearchParams;
  /** Rota da listagem, preservada na paginação e nos filtros. */
  basePath: string;
  /** Lista os lotes de um leilão (no detalhe do leilão). Sem ele, é a visão global. */
  auctionId?: string;
};

/** Lê filtros da URL, mostra a barra e a lista. Renderizar dentro de <Suspense>. */
export async function LotsView({ searchParams, basePath, auctionId }: LotsViewProps) {
  const raw = await searchParams;
  const filters = lotFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
  );
  const values: LotFilterValues = {
    busca: filters.search,
    acompanhados: filters.followedOnly,
    analise: filters.analysis,
    resultado: filters.result,
    arquivados: filters.archived,
  };

  return (
    <div className="grid gap-6">
      <LotFiltersBar values={values} basePath={basePath} />
      <LotList filters={filters} basePath={basePath} auctionId={auctionId} params={toUrlParams(values)} />
    </div>
  );
}

async function LotList({
  filters,
  basePath,
  auctionId,
  params,
}: {
  filters: LotFilters;
  basePath: string;
  auctionId?: string;
  params: Record<string, string | undefined>;
}) {
  const result = await listLots(filters, { auctionId });
  const showAuction = !auctionId;

  if (result.total === 0) {
    const hasFilters = Boolean(filters.search || filters.followedOnly || filters.analysis || filters.result);
    if (filters.archived) {
      return <EmptyState icon={Archive} title="Nenhum lote arquivado" description="Lotes arquivados aparecem aqui." />;
    }
    if (hasFilters) {
      return (
        <EmptyState icon={SearchX} title="Nenhum lote encontrado" description="Ajuste a busca ou limpe os filtros." />
      );
    }
    return (
      <EmptyState
        icon={Package}
        title="Nenhum lote cadastrado"
        description={
          auctionId
            ? "Adicione os lotes que deseja acompanhar neste leilão."
            : "Os lotes são cadastrados a partir de um leilão."
        }
        action={
          auctionId ? (
            <ButtonLink href={`/leiloes/${auctionId}/lotes/novo` as Route}>
              <Plus aria-hidden="true" />
              Adicionar lote
            </ButtonLink>
          ) : (
            <ButtonLink href="/leiloes" variant="secondary">
              Ver leilões
            </ButtonLink>
          )
        }
      />
    );
  }

  return (
    <section aria-label="Lotes" className="grid gap-4">
      {/* Mobile: linha empilhada (DESIGN.md §19.5). */}
      <ul className="grid gap-3 md:hidden">
        {result.items.map((lot) => (
          <li key={lot.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/lotes/${lot.id}`} className="min-w-0 text-body font-semibold text-accent hover:underline">
                {vehicleTitle(lot)}
              </Link>
              <StateBadges lot={lot} />
            </div>
            <p className="mt-1 text-caption text-muted">
              Lote {lot.lotNumber}
              {showAuction ? ` · ${lot.auction.name}` : null}
            </p>
            <dl className="mt-3 grid gap-2 text-caption">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Lance atual</dt>
                <dd>
                  <Money value={lot.currentBid} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Meu limite</dt>
                <dd>
                  <Money value={lot.limit?.maxBid ?? null} />
                </dd>
              </div>
            </dl>
            <div className="mt-3">
              <LimitBadge limit={lot.limit} bid={lot.currentBid} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet e desktop: tabela. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Veículo</TableHead>
              {showAuction ? <TableHead>Leilão</TableHead> : null}
              <TableHead className="text-right">Lance atual</TableHead>
              <TableHead className="text-right">Meu limite</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((lot) => (
              <TableRow key={lot.id}>
                <TableCell className="font-mono whitespace-nowrap">{lot.lotNumber}</TableCell>
                <TableCell>
                  <Link href={`/lotes/${lot.id}`} className="font-semibold text-accent hover:underline">
                    {vehicleTitle(lot)}
                  </Link>
                  <div className="mt-1">
                    <StateBadges lot={lot} />
                  </div>
                </TableCell>
                {showAuction ? (
                  <TableCell>
                    <Link href={`/leiloes/${lot.auction.id}`} className="hover:underline">
                      {lot.auction.name}
                    </Link>
                    <p className="text-caption text-muted">{formatDate(lot.auction.startsAt)}</p>
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <Money value={lot.currentBid} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={lot.limit?.maxBid ?? null} />
                </TableCell>
                <TableCell>
                  <LimitBadge limit={lot.limit} bid={lot.currentBid} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ListPagination
        basePath={basePath}
        params={params}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </section>
  );
}

function vehicleTitle(lot: LotListItem) {
  return `${lot.brand} ${lot.model} ${lot.modelYear}`;
}

function StateBadges({ lot }: { lot: LotListItem }) {
  const isArchived = lot.archivedAt !== null || lot.auction.archivedAt !== null;
  return (
    <span className="flex flex-wrap gap-1">
      {lot.isFollowed ? <Badge variant="primary">Acompanhando</Badge> : null}
      {lot.hasResult ? <Badge>Com resultado</Badge> : null}
      {isArchived ? <Badge variant="outline">Arquivado</Badge> : null}
    </span>
  );
}

export function LotsViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-36" />
      <Skeleton className="h-80" />
    </div>
  );
}

function toUrlParams(values: LotFilterValues): Record<string, string | undefined> {
  return {
    busca: values.busca,
    acompanhados: values.acompanhados ? "1" : undefined,
    analise: values.analise,
    resultado: values.resultado,
    arquivados: values.arquivados ? "1" : undefined,
  };
}
