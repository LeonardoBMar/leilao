"use client";

import { GitCompareArrows, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useRef, useState } from "react";

import { ActiveFilterChips } from "@/components/layout/active-filter-chips";
import {
  Button,
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import {
  DEFAULT_RESEARCH_FILTERS,
  normalizeComparison,
  normalizeYears,
  RESEARCH_CATEGORIES,
  type ResearchFilters,
  vehicleLabel,
} from "@/domain/research/filters";
import { STATE_NAMES } from "@/domain/research/states";
import { MOTION_ENTER_TRANSITION, MOTION_EXIT_TRANSITION } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { CATEGORY_LABELS, CONDITION_LABELS, mileageLabel, periodLabel, salesLabel, yearRangeLabel } from "../labels";
import { parseResearchParams } from "../schemas";
import { researchHref } from "../search";
import { pickSharedQuery, rememberMarketContext } from "../tab-context";
import type { ResearchFacets } from "../types";
import {
  CompareStateSelect,
  ConditionSelect,
  MileageSelect,
  OptionWithCount,
  PeriodSelect,
  researchActiveTriggerClass,
  SourceSelect,
  StateSelect,
  YearSelect,
} from "./filters/research-filter-selects";
import { ModelPicker } from "./model-picker";
import { useResearchTransition } from "./research-shell";

type ResearchFilterBarProps = {
  /** Filtros da URL na forma canônica (`researchParams`), já aplicados à tela. */
  params: Readonly<Record<string, string>>;
  facets: ResearchFacets;
};

/** Filtro ativo da gaveta, como chip removível. */
type ActiveFilter = { id: string; label: string; without: ResearchFilters };

/** Os filtros da gaveta que fogem do padrão, na ordem da gaveta. Modelo e categoria ficam na barra. */
function activeFilters(filters: ResearchFilters, sourceNames: Readonly<Record<string, string>>): ActiveFilter[] {
  const years = yearRangeLabel(filters);
  return [
    filters.condition === DEFAULT_RESEARCH_FILTERS.condition
      ? null
      : {
          id: "condicao",
          label: CONDITION_LABELS[filters.condition],
          without: { ...filters, condition: DEFAULT_RESEARCH_FILTERS.condition },
        },
    filters.state === null
      ? null
      : { id: "uf", label: STATE_NAMES[filters.state], without: { ...filters, state: null } },
    filters.source === null
      ? null
      : { id: "fonte", label: sourceNames[filters.source] ?? filters.source, without: { ...filters, source: null } },
    filters.maxKm === null
      ? null
      : { id: "km", label: `Até ${mileageLabel(filters.maxKm)}`, without: { ...filters, maxKm: null } },
    years === null ? null : { id: "ano", label: years, without: { ...filters, yearFrom: null, yearTo: null } },
    filters.period === null
      ? null
      : { id: "periodo", label: periodLabel(filters.period), without: { ...filters, period: null } },
  ].filter((chip) => chip !== null);
}

/** Os filtros com a gaveta no padrão: modelo, categoria e comparação ficam. */
function withoutDrawerFilters(filters: ResearchFilters): ResearchFilters {
  return {
    ...filters,
    condition: DEFAULT_RESEARCH_FILTERS.condition,
    state: null,
    source: null,
    maxKm: null,
    yearFrom: null,
    yearTo: null,
    period: null,
  };
}

/**
 * Barra de filtros do Panorama (DESIGN.md §15.8, docs/PLANO-MERCADO.md §6): na linha fixa, o modelo, a categoria,
 * "Mais filtros" (gaveta com condição, estado, fonte, km, ano e, quando a base cobre, período), a comparação e o total; embaixo, os filtros ativos em
 * chips. Cada escolha aplica na hora e vai para a URL; enquanto a tela recarrega, os controles já mostram a escolha.
 */
export function ResearchFilterBar({ params, facets }: ResearchFilterBarProps) {
  const router = useRouter();
  const categoryLabelId = useId();
  // Chip e "Limpar tudo" somem ao aplicar: o foco vai para o total, que anuncia o resultado.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const { isPending, startTransition } = useResearchTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parseResearchParams(params));
  const compareRowId = useId();
  // A linha "Comparar com" só aparece aberta pelo botão ou com uma comparação na URL.
  const [compareOpen, setCompareOpen] = useState(false);
  const showCompare = compareOpen || filters.compare !== null;
  const total = facets.conditions[filters.condition];
  const isDefault = Object.keys(params).length === 0;
  const chips = activeFilters(filters, Object.fromEntries(facets.sources.map(({ id, name }) => [id, name])));

  const resolvedSharedQuery = pickSharedQuery(params);
  useEffect(() => {
    rememberMarketContext({ shared: resolvedSharedQuery });
  }, [resolvedSharedQuery]);

  function apply(changed: ResearchFilters, { focusStatus = false } = {}) {
    // A comparação acompanha os filtros: outro modelo ou estado igual ao principal deixa de ser comparação. A venda
    // escolhida é de um recorte: outro filtro a fecha.
    const next = { ...changed, compare: normalizeComparison(changed, changed.compare), sale: null };
    startTransition(() => {
      setOptimisticFilters(next);
      router.push(researchHref(next), { scroll: false });
    });
    if (focusStatus) statusRef.current?.focus();
  }

  return (
    <>
      {/* Só a linha principal fica fixa, numa linha só, a partir de `xl`: com o menu lateral, a `lg` tem ~650 px de conteúdo. */}
      <section
        aria-label="Filtros"
        className="border-b border-border bg-surface pb-3 xl:sticky xl:top-12 xl:z-30 xl:py-2.5"
      >
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <ModelPicker
            value={filters.vehicle === null ? null : vehicleLabel(filters.vehicle)}
            options={facets.models}
            onChange={(option) =>
              // Os anos são de um modelo: outro modelo recomeça sem faixa.
              apply({
                ...filters,
                vehicle: option === null ? null : { brand: option.brand, model: option.model },
                yearFrom: null,
                yearTo: null,
              })
            }
            className="w-full md:w-auto md:min-w-56 md:flex-1"
          />
          <span id={categoryLabelId} className="sr-only">
            Categoria
          </span>
          <Select
            value={filters.category}
            onValueChange={(value) => {
              const category = RESEARCH_CATEGORIES.find((key) => key === value);
              if (category) apply({ ...filters, category });
            }}
          >
            <SelectTrigger aria-labelledby={categoryLabelId} className="flex-1 md:w-36 md:flex-none">
              <SelectValue>{CATEGORY_LABELS[filters.category]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RESEARCH_CATEGORIES.map((category) => (
                <SelectItem
                  key={category}
                  value={category}
                  disabled={facets.categories[category] === 0 && category !== filters.category}
                >
                  <OptionWithCount label={CATEGORY_LABELS[category]} count={facets.categories[category]} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                className={cn("flex-1 md:flex-none", chips.length > 0 && researchActiveTriggerClass)}
              >
                <SlidersHorizontal aria-hidden="true" />
                Mais filtros{chips.length > 0 ? ` (${chips.length})` : ""}
              </Button>
            </DialogTrigger>
            <DrawerContent side="right">
              <DialogHeader className="border-b border-border px-6 py-5">
                <DialogTitle>Mais filtros</DialogTitle>
                <DialogDescription className="text-caption text-muted">Cada escolha aplica na hora.</DialogDescription>
              </DialogHeader>
              <DrawerBody className="gap-6">
                <fieldset className="grid gap-4">
                  <legend className="mb-1 text-caption font-semibold text-muted">Veículo</legend>
                  <ConditionSelect
                    value={filters.condition}
                    counts={facets.conditions}
                    onChange={(condition) => apply({ ...filters, condition })}
                  />
                  <MileageSelect
                    value={filters.maxKm}
                    mileage={facets.mileage}
                    onChange={(maxKm) => apply({ ...filters, maxKm })}
                  />
                  {filters.vehicle === null ? (
                    <p className="text-caption text-muted">O ano-modelo aparece com um modelo escolhido.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <YearSelect
                        label="Ano-modelo de"
                        short={{ empty: "Ano inicial", prefix: "De" }}
                        value={filters.yearFrom}
                        years={facets.years}
                        onChange={(yearFrom) => apply({ ...filters, ...normalizeYears(yearFrom, filters.yearTo) })}
                      />
                      <YearSelect
                        label="Ano-modelo até"
                        short={{ empty: "Ano final", prefix: "Até" }}
                        value={filters.yearTo}
                        years={facets.years}
                        onChange={(yearTo) => apply({ ...filters, ...normalizeYears(filters.yearFrom, yearTo) })}
                      />
                    </div>
                  )}
                </fieldset>
                <fieldset className="grid gap-4 border-t border-border pt-5">
                  <legend className="mb-1 text-caption font-semibold text-muted">Leilão</legend>
                  <StateSelect
                    value={filters.state}
                    counts={facets.states}
                    onChange={(state) => apply({ ...filters, state })}
                  />
                  <SourceSelect
                    value={filters.source}
                    sources={facets.sources}
                    onChange={(source) => apply({ ...filters, source })}
                  />
                  {facets.periods.length > 0 || filters.period !== null ? (
                    <PeriodSelect
                      value={filters.period}
                      periods={facets.periods}
                      onChange={(period) => apply({ ...filters, period })}
                    />
                  ) : null}
                </fieldset>
              </DrawerBody>
              <DrawerFooter>
                <Button
                  variant="secondary"
                  onClick={() => apply(withoutDrawerFilters(filters))}
                  disabled={chips.length === 0}
                >
                  Limpar filtros
                </Button>
                <DialogClose asChild>
                  <Button aria-live="polite">{isPending ? "Atualizando…" : `Ver ${salesLabel(total)}`}</Button>
                </DialogClose>
              </DrawerFooter>
            </DrawerContent>
          </Dialog>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 md:flex-none"
            aria-expanded={showCompare}
            aria-controls={compareRowId}
            onClick={() => {
              if (filters.compare !== null) {
                setCompareOpen(false);
                apply({ ...filters, compare: null });
              } else setCompareOpen((open) => !open);
            }}
          >
            <GitCompareArrows aria-hidden="true" />
            {filters.compare !== null ? "Tirar comparação" : showCompare ? "Fechar comparação" : "Comparar"}
          </Button>
          <div className="flex w-full items-center gap-3 xl:ml-2 xl:w-auto xl:shrink-0">
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
                <span>
                  {salesLabel(total)}
                  <span className="sr-only"> com esses filtros</span>
                </span>
              )}
            </p>
            {isDefault ? null : (
              <Button
                variant="link"
                size="sm"
                className="h-10 px-1"
                onClick={() => apply(DEFAULT_RESEARCH_FILTERS, { focusStatus: true })}
              >
                Limpar tudo
              </Button>
            )}
          </div>
        </div>
      </section>

      {chips.length > 0 || showCompare ? (
        <div className="-mt-3 grid gap-3">
          {chips.length > 0 ? (
            <ActiveFilterChips
              chips={chips}
              onRemove={(id) => {
                const chip = chips.find((item) => item.id === id);
                if (chip) apply(chip.without, { focusStatus: true });
              }}
            />
          ) : null}
          <AnimatePresence initial={false}>
            {showCompare ? (
              <m.div
                key="compare-row"
                id={compareRowId}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: MOTION_ENTER_TRANSITION }}
                exit={{ opacity: 0, y: -6, transition: MOTION_EXIT_TRANSITION }}
                className="grid gap-3 md:flex md:flex-wrap md:items-center"
              >
                <span className="text-label text-muted">Comparar com</span>
                {filters.vehicle === null ? null : (
                  <ModelPicker
                    label="Comparar com outro modelo"
                    placeholder="Outro modelo"
                    shortcut={false}
                    clearLabel="Tirar o modelo da comparação"
                    value={filters.compare?.vehicle ? vehicleLabel(filters.compare.vehicle) : null}
                    options={facets.models.filter(
                      (option) => option.brand !== filters.vehicle?.brand || option.model !== filters.vehicle.model,
                    )}
                    onChange={(option) =>
                      apply({
                        ...filters,
                        compare: {
                          vehicle: option === null ? null : { brand: option.brand, model: option.model },
                          state: filters.compare?.state ?? null,
                        },
                      })
                    }
                    className="md:min-w-64 md:flex-1"
                  />
                )}
                <CompareStateSelect
                  value={filters.compare?.state ?? null}
                  current={filters.state}
                  counts={facets.states}
                  onChange={(state) =>
                    apply({ ...filters, compare: { vehicle: filters.compare?.vehicle ?? null, state } })
                  }
                />
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </>
  );
}
