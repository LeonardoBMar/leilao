"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useRef, useTransition } from "react";

import { ActiveFilterChips } from "@/components/layout/active-filter-chips";
import {
  SearchBox,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type { ListingCriteria } from "@/domain/listings/criteria";
import { formatInteger } from "@/lib/format";

import { activeFilters, clearedFilters, sortLabel } from "../../filter-labels";
import { type ListingFilters, listingParams, parseListingParams, SORT_KEYS } from "../../schemas";
import { withQuery } from "../../search";
import type { ListingFacetsView } from "../../types";
import { type FilterBarScope, ListingFilterDrawers } from "./listing-filter-drawers";

export type { FilterBarScope };

type ListingFilterBarProps = {
  /** Filtros da URL na forma canônica (`listingParams`), já aplicados ao resultado. */
  params: Readonly<Record<string, string>>;
  basePath: string;
  scope: FilterBarScope;
  total: number;
  facets: ListingFacetsView;
  regionLabel: string;
  currentYear: number;
  saveWatch?: React.ReactNode;
};

/** Filtros que ficam na barra (e não contam em "Mais filtros"). */
const BAR_FILTERS = ["busca", "preco", "mercado", "ano", "distancia"];

/**
 * Barra de filtros dos Leilões (docs/PLANO-FILTROS.md §2). Cada escolha aplica na hora e vai para a URL; enquanto a
 * tela recarrega, os controles já mostram a escolha (`useOptimistic`) e o total diz "Atualizando…".
 */
export function ListingFilterBar({
  params,
  basePath,
  scope,
  total,
  facets,
  regionLabel,
  currentYear,
  saveWatch,
}: ListingFilterBarProps) {
  const router = useRouter();
  const sortLabelId = useId();
  // Chip, atalho e "Limpar tudo" somem ao aplicar: o foco vai para o total, que anuncia o resultado.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const applyAndFocusStatus = (next: Parameters<typeof apply>[0]) => {
    apply(next);
    statusRef.current?.focus();
  };
  const [isPending, startTransition] = useTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parseListingParams(params));
  const { criteria } = filters;
  const sourceNames = Object.fromEntries(facets.sources.map((source) => [source.id, source.name]));
  const chips = activeFilters(filters, sourceNames);
  const moreCount = chips.filter((chip) => !BAR_FILTERS.includes(chip.id)).length;
  const mobileCount = chips.filter((chip) => chip.id !== "busca").length;

  function apply(next: ListingFilters) {
    const target = { ...next, page: 1 };
    startTransition(() => {
      setOptimisticFilters(target);
      router.push(withQuery(basePath, listingParams(target)), { scroll: false });
    });
  }
  const applyCriteria = (patch: Partial<ListingCriteria>) =>
    apply({ ...filters, criteria: { ...filters.criteria, ...patch } });

  const unit = scope === "auctions" ? { one: "leilão", many: "leilões" } : { one: "lote", many: "lotes" };
  const countText = `${formatInteger(total)} ${total === 1 ? unit.one : unit.many}`;
  const situation = filters.ended ? (total === 1 ? "encerrado" : "encerrados") : total === 1 ? "aberto" : "abertos";

  const shortcuts = [
    filters.ended || filters.endsWithin !== null
      ? null
      : { label: "Encerra em 48 h", next: { ...filters, endsWithin: "48h" as const } },
    criteria.condition !== "qualquer"
      ? null
      : { label: "Sem monta", next: { ...filters, criteria: { ...criteria, condition: "sem-monta" as const } } },
    criteria.maxMarketPct !== null
      ? null
      : { label: "Até 60% do mercado", next: { ...filters, criteria: { ...criteria, maxMarketPct: 60 } } },
    filters.newOnly ? null : { label: "Novos (24 h)", next: { ...filters, newOnly: true } },
  ].filter((shortcut) => shortcut !== null);

  return (
    <section aria-label="Filtros" className="grid gap-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={criteria.search}
          suggestions={facets.suggestions}
          onSearch={(search) => applyCriteria({ search })}
          className="w-full md:w-auto md:min-w-64 md:flex-1"
        />
        <ListingFilterDrawers
          filters={filters}
          scope={scope}
          facets={facets}
          regionLabel={regionLabel}
          currentYear={currentYear}
          countText={countText}
          isPending={isPending}
          moreCount={moreCount}
          mobileCount={mobileCount}
          hasChips={chips.length > 0}
          onApply={apply}
          onApplyCriteria={applyCriteria}
          onClearAll={() => apply(clearedFilters(filters))}
        />
      </div>

      <ActiveFilterChips
        chips={chips}
        onRemove={(id) => {
          const chip = chips.find((item) => item.id === id);
          if (chip) applyAndFocusStatus(chip.without);
        }}
        onClearAll={() => applyAndFocusStatus(clearedFilters(filters))}
        shortcuts={shortcuts.map((shortcut) => ({ id: shortcut.label, label: shortcut.label }))}
        onApplyShortcut={(id) => {
          const shortcut = shortcuts.find((item) => item.label === id);
          if (shortcut) applyAndFocusStatus(shortcut.next);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p
          ref={statusRef}
          role="status"
          tabIndex={-1}
          className="flex items-center gap-2 rounded-sm text-label text-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {isPending ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-muted" />
              <span className="text-muted">Atualizando…</span>
            </>
          ) : (
            `${countText} ${situation}`
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Situação"
            hideLabel
            value={filters.ended ? "encerrados" : "abertos"}
            options={[
              { value: "abertos", label: "Abertos" },
              { value: "encerrados", label: "Encerrados" },
            ]}
            onValueChange={(value) => apply({ ...filters, ended: value === "encerrados" })}
            className="w-56"
          />
          {scope === "auctions" ? null : (
            <div className="flex items-center gap-2">
              <span id={sortLabelId} className="text-label text-foreground-secondary">
                Ordenar
              </span>
              <Select
                value={filters.sort}
                onValueChange={(value) => {
                  const sort = SORT_KEYS.find((key) => key === value);
                  if (sort) apply({ ...filters, sort });
                }}
              >
                <SelectTrigger aria-labelledby={sortLabelId} className="w-56">
                  <SelectValue>{sortLabel(filters.sort, filters.ended)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORT_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {sortLabel(key, filters.ended)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {saveWatch}
        </div>
      </div>
    </section>
  );
}
