"use client";

import { ArrowDown, ArrowUp, ChartSpline, ChevronsUpDown } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import { useId, useState } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import { isStateCode, STATE_NAMES } from "@/domain/research/states";
import { formatBRL, formatDate, formatKm, formatRatio } from "@/lib/format";
import { cn } from "@/lib/utils";

import { salesLabel } from "../labels";
import { salesByState, type SaleSortKey, type SortDirection, sortSales } from "../sales-sort";
import type { ResearchSale } from "../types";

/** Vendas na tabela fechada; "Ver todas" mostra o resto. */
const VISIBLE_SALES = 10;

const ALL_STATES = "todos";

/** Valor de mercado casado pelo sistema (D-47) é marcado na tabela; o da fonte fica sem marca. */
const MARKET_ORIGIN_MARKS = {
  source: "",
  fipe_version: " · FIPE",
  fipe_family: " · FIPE aprox.",
} satisfies Record<MarketValueOrigin, string>;

/** O lance e o % logo depois do anúncio: no celular, a tabela rola para o lado e eles ficam à vista. */
const COLUMNS = [
  { key: "date", label: "Data" },
  { key: "sale", label: "Anúncio" },
  { key: "bid", label: "Lance final", align: "right" },
  { key: "ratio", label: "% do mercado", align: "right" },
  { key: "year", label: "Ano", align: "right" },
  { key: "km", label: "Km", align: "right" },
  { key: "market", label: "Valor de mercado", align: "right" },
] as const satisfies readonly { key: SaleSortKey | "sale"; label: string; align?: "right" }[];

/**
 * Tabela das vendas do modelo (D-45): ordenável por data, lance, %, ano, km e valor de mercado, com filtro rápido por
 * estado e a miniatura do anúncio. A ordem e o filtro são só desta tela (não vão para a URL): o recorte das vendas é o
 * dos filtros da Pesquisa.
 */
export function ModelSalesTable({
  sales,
  selectedSale,
}: {
  /** Com o link dos lances (`null` quando o coletor só viu o lance final). */
  sales: readonly (ResearchSale & { bidsHref: Route | null })[];
  /** Venda com os lances abertos, marcada na tabela. */
  selectedSale: string | null;
}) {
  const [sort, setSort] = useState<{ key: SaleSortKey; direction: SortDirection }>({ key: "date", direction: "desc" });
  const [state, setState] = useState(ALL_STATES);
  const [expanded, setExpanded] = useState(false);
  const stateLabelId = useId();

  const states = salesByState(sales);
  const filtered = state === ALL_STATES ? sales : sales.filter((sale) => sale.state === state);
  const sorted = sortSales(filtered, sort.key, sort.direction);
  const shown = expanded ? sorted : sorted.slice(0, VISIBLE_SALES);

  function sortBy(key: SaleSortKey) {
    // Primeiro toque: do maior para o menor (mais recente, maior lance); o segundo inverte.
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span id={stateLabelId} className="sr-only">
          Estado das vendas na tabela
        </span>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger aria-labelledby={stateLabelId} className="sm:w-56">
            <SelectValue>{isStateCode(state) ? STATE_NAMES[state] : "Todos os estados"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATES}>Todos os estados</SelectItem>
            {states.map(({ state: code, sales: n }) => (
              <SelectItem key={code} value={code}>
                {isStateCode(code) ? STATE_NAMES[code] : code} ({n})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p role="status" className="text-label font-normal text-muted tabular-nums">
          {state === ALL_STATES ? salesLabel(sales.length) : `${salesLabel(filtered.length)} de ${sales.length}`}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => {
              const right = "align" in column;
              const sortKey = column.key === "sale" ? null : column.key;
              const direction = sortKey !== null && sort.key === sortKey ? sort.direction : null;
              return (
                <TableHead
                  key={column.key}
                  className={cn(right && "text-right")}
                  aria-sort={direction === null ? undefined : direction === "asc" ? "ascending" : "descending"}
                >
                  {sortKey === null ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => sortBy(sortKey)}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
                        direction !== null && "text-foreground",
                      )}
                    >
                      {column.label}
                      {direction === null ? (
                        <ChevronsUpDown aria-hidden="true" className="size-3.5" />
                      ) : direction === "asc" ? (
                        <ArrowUp aria-hidden="true" className="size-3.5" />
                      ) : (
                        <ArrowDown aria-hidden="true" className="size-3.5" />
                      )}
                    </button>
                  )}
                </TableHead>
              );
            })}
            <TableHead>
              <span className="sr-only">Lances</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((sale) => (
            <TableRow
              key={sale.id}
              aria-current={sale.id === selectedSale || undefined}
              className={cn(sale.id === selectedSale && "bg-surface-subtle")}
            >
              <TableCell className="tabular-nums">{formatDate(sale.endsAt)}</TableCell>
              <TableCell>
                <SaleLink sale={sale} />
              </TableCell>
              <Cell>{formatBRL(sale.finalBid)}</Cell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {sale.ratio === null ? (
                  "—"
                ) : sale.ratioInBounds ? (
                  formatRatio(sale.ratio)
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Badge variant="outline" title="Fora das estatísticas: valor de mercado provavelmente errado">
                      fora do %
                    </Badge>
                    {formatRatio(sale.ratio)}
                  </span>
                )}
              </TableCell>
              <Cell>{sale.modelYear === null ? null : String(sale.modelYear)}</Cell>
              <Cell>{sale.mileageKm === null ? null : formatKm(sale.mileageKm)}</Cell>
              <Cell>
                {sale.marketValue === null
                  ? null
                  : `${formatBRL(sale.marketValue)}${MARKET_ORIGIN_MARKS[sale.marketValueOrigin ?? "source"]}`}
              </Cell>
              <TableCell className="text-right">
                {sale.bidsHref === null ? null : (
                  <ButtonLink
                    href={sale.bidsHref}
                    scroll={false}
                    variant="ghost"
                    size="icon"
                    aria-label={`Ver os lances de ${sale.title}`}
                    title="Ver os lances antes do fim"
                  >
                    <ChartSpline aria-hidden="true" />
                  </ButtonLink>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {sorted.length > VISIBLE_SALES ? (
        <Button variant="link" size="sm" className="h-10 w-fit px-0" onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Mostrar só as primeiras" : `Ver todas as ${sorted.length} vendas`}
        </Button>
      ) : null}
    </div>
  );
}

/** Célula numérica à direita; sem o dado, o traço (nunca zero). */
function Cell({ children }: { children: string | null }) {
  return <TableCell className="text-right whitespace-nowrap tabular-nums">{children ?? "—"}</TableCell>;
}

function SaleLink({ sale }: { sale: ResearchSale }) {
  return (
    <span className="flex min-w-56 items-center gap-3">
      <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-sm bg-surface-subtle">
        {sale.photoUrl ? (
          <Image src={sale.photoUrl} alt="" fill unoptimized loading="lazy" sizes="3rem" className="object-cover" />
        ) : null}
      </span>
      <span className="grid min-w-0 gap-0.5">
        <a
          href={sale.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-accent hover:text-accent-hover hover:underline"
        >
          {sale.title}
        </a>
        <span className="text-caption text-muted">
          {[sale.city && sale.state ? `${sale.city}/${sale.state}` : sale.state, sale.source]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </span>
  );
}
