import { Archive, Gavel, Plus, SearchX } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { ListPagination } from "@/components/layout/list-pagination";
import {
  Badge,
  ButtonLink,
  EmptyState,
  LinkTabs,
  Section,
  SectionHeader,
  SectionTitle,
  Skeleton,
} from "@/components/ui";
import { catalogAuctionPath, type SearchParams, withQuery } from "@/features/listings/search";
import { formatDateTime } from "@/lib/format";

import { activeLotFilters, clearedLotFilters } from "../filter-labels";
import { listLotsByAuction } from "../queries";
import { type LotFilters, lotParams } from "../schemas";
import type { LotAuctionGroup, LotGroupPage } from "../types";
import { LotFilters as LotFiltersBar } from "./lot-filters";
import { LotRows, LotsView, readLotSearch } from "./lot-list";

const BASE_PATH = "/minhas-analises";
const BY_AUCTION = { vista: "leilao" } as const;
const AUCTION_UNIT = { one: "leilão", many: "leilões" };

/**
 * "Minhas análises" (D-42): os lotes do usuário, todos (padrão) ou agrupados por leilão (`?vista=leilao`), com os
 * mesmos filtros. Renderizar dentro de <Suspense>.
 */
export async function MyAnalysesView({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const byAuction = (Array.isArray(raw.vista) ? raw.vista[0] : raw.vista) === BY_AUCTION.vista;
  const { filters, params } = readLotSearch(raw);

  return (
    <div className="grid gap-6">
      <LinkTabs
        label="Visões de minhas análises"
        tabs={[
          { href: withQuery(BASE_PATH, params), label: "Todos os lotes", active: !byAuction },
          { href: withQuery(BASE_PATH, { ...params, ...BY_AUCTION }), label: "Por leilão", active: byAuction },
        ]}
      />
      {byAuction ? (
        <LotGroups filters={filters} params={params} />
      ) : (
        <LotsView searchParams={searchParams} basePath={BASE_PATH} />
      )}
    </div>
  );
}

async function LotGroups({ filters, params }: { filters: LotFilters; params: Record<string, string> }) {
  const page = await listLotsByAuction(filters);
  return (
    <div className="grid gap-6">
      <LotFiltersBar
        params={params}
        basePath={BASE_PATH}
        fixedParams={BY_AUCTION}
        total={page.total}
        unit={AUCTION_UNIT}
        sortable={false}
      />
      <LotGroupList page={page} filters={filters} params={{ ...params, ...BY_AUCTION }} />
    </div>
  );
}

function LotGroupList({
  page,
  filters,
  params,
}: {
  page: LotGroupPage;
  filters: LotFilters;
  params: Record<string, string>;
}) {
  if (page.total === 0) {
    const hasFilters = activeLotFilters(filters).some((chip) => chip.id !== "arquivados");
    if (filters.archived && !hasFilters) {
      return (
        <EmptyState icon={Archive} title="Nenhum leilão arquivado" description="Leilões arquivados aparecem aqui." />
      );
    }
    if (hasFilters) {
      return (
        <EmptyState
          icon={SearchX}
          title="Nenhum lote encontrado"
          description="Nenhum lote atende a esses filtros."
          action={
            <ButtonLink
              href={withQuery(BASE_PATH, { ...lotParams(clearedLotFilters(filters)), ...BY_AUCTION })}
              variant="secondary"
            >
              Limpar filtros
            </ButtonLink>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={Gavel}
        title="Nenhum leilão cadastrado"
        description="Leve um lote para análise a partir de Leilões ou cadastre um leilão."
        action={
          <ButtonLink href="/leiloes" variant="secondary">
            Ver leilões
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid gap-10">
      {page.groups.map((group) => (
        <LotGroup key={group.auction.id} group={group} />
      ))}
      <ListPagination
        basePath={BASE_PATH}
        params={params}
        page={page.page}
        pageSize={page.pageSize}
        total={page.total}
      />
    </div>
  );
}

/** Um leilão do usuário (DESIGN.md §15.3.1): cabeçalho com o leilão e as linhas dos seus lotes. */
function LotGroup({ group: { auction, lots } }: { group: LotAuctionGroup }) {
  const headingId = `auction-${auction.id}`;
  const auctionHref = `/minhas-analises/leiloes/${auction.id}` as Route;

  return (
    <Section aria-labelledby={headingId} className="gap-2">
      <SectionHeader className="items-end">
        <div className="grid min-w-0 gap-0.5">
          <p className="text-caption text-muted">
            {formatDateTime(auction.startsAt)} · {auction.auctioneer}
          </p>
          <SectionTitle id={headingId}>
            <Link href={auctionHref} className="hover:underline">
              {auction.name}
            </Link>
          </SectionTitle>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-foreground-secondary tabular-nums">
            <span>
              {lots.length} {lots.length === 1 ? "lote seu" : "lotes seus"}
            </span>
            {auction.catalog ? (
              <>
                <span aria-hidden="true">·</span>
                <Link href={catalogAuctionPath(auction.catalog)} className="hover:text-foreground hover:underline">
                  {auction.catalog.total} no catálogo
                </Link>
              </>
            ) : null}
            {auction.archivedAt ? <Badge variant="outline">Arquivado</Badge> : null}
          </p>
        </div>
        <ButtonLink href={`/minhas-analises/leiloes/${auction.id}/lotes/novo`} variant="ghost" size="sm">
          <Plus aria-hidden="true" />
          Adicionar lote
        </ButtonLink>
      </SectionHeader>
      {lots.length > 0 ? (
        <LotRows items={lots} showAuction={false} />
      ) : (
        <p className="border-t border-border py-4 text-body text-muted">Nenhum lote neste leilão.</p>
      )}
    </Section>
  );
}

export function MyAnalysesViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-10" />
      <Skeleton className="h-36" />
      <Skeleton className="h-80" />
    </div>
  );
}
