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
import { withQuery } from "@/lib/catalog-search";
import { formatDate } from "@/lib/format";

import { activeLotFilters, clearedLotFilters } from "../filter-labels";
import { listLots } from "../queries";
import { type LotFilters, lotParams, parseLotParams } from "../schemas";
import type { LotListItem, LotPage } from "../types";
import { LimitProgress } from "./limit-progress";
import { LotFilters as LotFiltersBar } from "./lot-filters";
import { LotRowMenu } from "./lot-row-menu";
import { LotBulkBar, LotSelectAll, LotSelectCheckbox, LotSelectionProvider } from "./lot-selection";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type LotsViewProps = {
  searchParams: SearchParams;
  /** Rota da listagem, preservada na paginação e nos filtros. */
  basePath: string;
  /** Lista os lotes de um leilão (no detalhe do leilão). Sem ele, é a visão global. */
  auctionId?: string;
};

/** Filtros de lotes a partir da URL: `filters` para a consulta e `params` (forma canônica) para links e paginação. */
export function readLotSearch(raw: Readonly<Record<string, string | string[] | undefined>>) {
  const filters = parseLotParams(raw);
  return { filters, params: lotParams(filters) };
}

const LOT_UNIT = { one: "lote", many: "lotes" };

/** Lê filtros da URL, mostra a barra (com o total) e a lista. Renderizar dentro de <Suspense>. */
export async function LotsView({ searchParams, basePath, auctionId }: LotsViewProps) {
  const { filters, params } = readLotSearch(await searchParams);
  const result = await listLots(filters, { auctionId });

  return (
    <div className="grid gap-6">
      <LotFiltersBar
        params={params}
        basePath={basePath}
        total={result.total}
        unit={LOT_UNIT}
        inAuction={auctionId !== undefined}
      />
      <LotList result={result} filters={filters} basePath={basePath} auctionId={auctionId} params={params} />
    </div>
  );
}

function LotList({
  result,
  filters,
  basePath,
  auctionId,
  params,
}: {
  result: LotPage;
  filters: LotFilters;
  basePath: string;
  auctionId?: string;
  params: Record<string, string>;
}) {
  const showAuction = !auctionId;

  if (result.total === 0) {
    const hasFilters = activeLotFilters(filters).some((chip) => chip.id !== "arquivados");
    if (filters.archived && !hasFilters) {
      return <EmptyState icon={Archive} title="Nenhum lote arquivado" description="Lotes arquivados aparecem aqui." />;
    }
    if (hasFilters) {
      return (
        <EmptyState
          icon={SearchX}
          title="Nenhum lote encontrado"
          description="Nenhum lote atende a esses filtros."
          action={
            <ButtonLink href={withQuery(basePath, lotParams(clearedLotFilters(filters)))} variant="secondary">
              Limpar filtros
            </ButtonLink>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={Package}
        title="Nenhum lote cadastrado"
        description={
          auctionId
            ? "Adicione os lotes que deseja acompanhar neste leilão."
            : "Leve um lote para análise a partir de Leilões ou cadastre um leilão em Minhas análises."
        }
        action={
          auctionId ? (
            <ButtonLink href={`/minhas-analises/leiloes/${auctionId}/lotes/novo` as Route}>
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
      {/* A chave remonta a seleção quando a página ou os filtros mudam. */}
      <LotSelectionProvider key={JSON.stringify(params)} ids={result.items.map((lot) => lot.id)}>
        <LotBulkBar />
        <LotRows items={result.items} showAuction={showAuction} />
      </LotSelectionProvider>

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

/** Lotes em linhas: empilhadas no mobile e tabela a partir de `md`. `showAuction` mostra o leilão de cada lote. */
export function LotRows({ items, showAuction }: { items: readonly LotListItem[]; showAuction: boolean }) {
  return (
    <>
      {/* Mobile: linha empilhada (DESIGN.md §19.5). */}
      <ul className="border-b border-border md:hidden">
        {items.map((lot) => (
          <li key={lot.id} className="grid gap-3 border-t border-border py-4">
            <div className="flex items-start justify-between gap-3">
              <LotSelectCheckbox lotId={lot.id} label={rowLabel(lot)} />
              <div className="min-w-0 flex-1">
                <Link href={`/lotes/${lot.id}`} className="text-body font-semibold text-foreground hover:underline">
                  {vehicleTitle(lot)}
                </Link>
                <p className="text-caption text-muted">
                  <span className="font-mono">Lote {lot.lotNumber}</span>
                  {showAuction ? ` · ${lot.auction.name}` : null} · {formatDate(lot.auction.startsAt)}
                </p>
              </div>
              <RowMenu lot={lot} />
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
              <SelectHead />
              <TableHead className="w-18">Lote</TableHead>
              <TableHead>{showAuction ? "Veículo e leilão" : "Veículo"}</TableHead>
              <TableHead className="text-right">Lance atual</TableHead>
              <TableHead className="text-right">Meu limite</TableHead>
              <TableHead className="w-56 pl-6">Posição</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((lot) => (
              <TableRow key={lot.id}>
                <SelectCell lotId={lot.id} label={rowLabel(lot)} />
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
                        <Link
                          href={`/minhas-analises/leiloes/${lot.auction.id}`}
                          className="hover:text-foreground hover:underline"
                        >
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
                  <StateBadges lot={lot} />
                </TableCell>
                <TableCell className="text-right">
                  <RowMenu lot={lot} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/**
 * Coluna de seleção: os checkboxes só aparecem dentro de um LotSelectionProvider (a lista principal). Sem ele, a
 * célula fica vazia e estreita.
 */
function SelectHead() {
  return (
    <TableHead className="w-12 px-1 empty:w-0 empty:p-0">
      <LotSelectAll />
    </TableHead>
  );
}

function SelectCell({ lotId, label }: { lotId: string; label: string }) {
  return (
    <TableCell className="px-1 empty:p-0">
      <LotSelectCheckbox lotId={lotId} label={label} />
    </TableCell>
  );
}

function rowLabel(lot: LotListItem) {
  return `Lote ${lot.lotNumber} · ${vehicleTitle(lot)}`;
}

function RowMenu({ lot }: { lot: LotListItem }) {
  return (
    <LotRowMenu
      lotId={lot.id}
      lotLabel={rowLabel(lot)}
      currentBid={lot.currentBid}
      openDraftId={lot.openDraftId}
      isFollowed={lot.isFollowed}
      isArchived={lot.archivedAt !== null}
    />
  );
}

function vehicleTitle(lot: LotListItem) {
  return `${lot.brand} ${lot.model} ${lot.modelYear}`;
}

function StateBadges({ lot }: { lot: LotListItem }) {
  const isArchived = lot.archivedAt !== null || lot.auction.archivedAt !== null;
  return (
    <span className="flex flex-wrap gap-1 empty:hidden">
      {lot.openDraftId ? (
        <Link
          href={`/analise/${lot.openDraftId}`}
          aria-label={`Continuar rascunho do ${rowLabel(lot)}`}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          <Badge variant="warning" className="hover:underline">
            Rascunho
          </Badge>
        </Link>
      ) : null}
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
