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
import { LimitProgress } from "./limit-progress";
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
      <ul className="border-b border-border md:hidden">
        {result.items.map((lot) => (
          <li key={lot.id} className="grid gap-3 border-t border-border py-4">
            <div className="min-w-0">
              <Link href={`/lotes/${lot.id}`} className="text-body font-semibold text-foreground hover:underline">
                {vehicleTitle(lot)}
              </Link>
              <p className="text-caption text-muted">
                <span className="font-mono">Lote {lot.lotNumber}</span>
                {showAuction ? ` · ${lot.auction.name}` : null} · {formatDate(lot.auction.startsAt)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-body">
              <div>
                <dt className="text-caption text-muted">Lance atual</dt>
                <dd>
                  <Money value={lot.currentBid} />
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted">Meu limite</dt>
                <dd>
                  <Money value={lot.limit?.maxBid ?? null} />
                </dd>
              </div>
            </dl>
            <LimitProgress limit={lot.limit} bid={lot.currentBid} />
            <StateBadges lot={lot} />
          </li>
        ))}
      </ul>

      {/* Tablet e desktop: tabela. */}
      <div className="hidden md:block">
        <Table className="min-w-200">
          <TableHeader>
            <TableRow>
              <TableHead className="w-18">Lote</TableHead>
              <TableHead>{showAuction ? "Veículo e leilão" : "Veículo"}</TableHead>
              <TableHead className="text-right">Lance atual</TableHead>
              <TableHead className="text-right">Meu limite</TableHead>
              <TableHead className="w-56 pl-6">Posição</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((lot) => (
              <TableRow key={lot.id}>
                <TableCell className="font-mono text-label font-normal whitespace-nowrap text-foreground-secondary">
                  {lot.lotNumber}
                </TableCell>
                <TableCell className="py-4">
                  <Link href={`/lotes/${lot.id}`} className="font-semibold text-foreground hover:underline">
                    {vehicleTitle(lot)}
                  </Link>
                  <p className="mt-0.5 text-caption text-muted">
                    {showAuction ? (
                      <>
                        <Link href={`/leiloes/${lot.auction.id}`} className="hover:text-foreground hover:underline">
                          {lot.auction.name}
                        </Link>
                        {" · "}
                      </>
                    ) : null}
                    {formatDate(lot.auction.startsAt)}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <Money value={lot.currentBid} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={lot.limit?.maxBid ?? null} />
                </TableCell>
                <TableCell className="pl-6">
                  <LimitProgress limit={lot.limit} bid={lot.currentBid} />
                </TableCell>
                <TableCell>
                  <div className="grid justify-items-start gap-1">
                    <LimitBadge limit={lot.limit} bid={lot.currentBid} />
                    <StateBadges lot={lot} />
                  </div>
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
    <span className="flex flex-wrap gap-1 empty:hidden">
      {lot.isFollowed ? <Badge>Acompanhando</Badge> : null}
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
