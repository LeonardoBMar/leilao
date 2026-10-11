"use client";

import { GitCompareArrows, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useOptimistic, useRef, useState } from "react";

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
  RemovableChip,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import {
  DEFAULT_RESEARCH_FILTERS,
  normalizeComparison,
  normalizeYears,
  RESEARCH_CATEGORIES,
  RESEARCH_CONDITIONS,
  RESEARCH_MILEAGE_OPTIONS,
  type ResearchCondition,
  type ResearchFilters,
  vehicleLabel,
} from "@/domain/research/filters";
import { isStateCode, STATE_CODES, STATE_NAMES, type StateCode } from "@/domain/research/states";
import { cn } from "@/lib/utils";

import { CATEGORY_LABELS, CONDITION_LABELS, mileageLabel, salesLabel, yearRangeLabel } from "../labels";
import { parseResearchParams } from "../schemas";
import { researchHref } from "../search";
import type { ResearchFacets } from "../types";
import { ModelPicker } from "./model-picker";
import { useResearchTransition } from "./research-shell";

/** Valor do item "Todo o Brasil": o `Select` não aceita valor vazio. */
const ALL_STATES = "todos";

/** Valor do item "Todos os anos". */
const ALL_YEARS = "todos";

/** Valor do item "Todas as fontes". */
const ALL_SOURCES = "todas";

/** Valor do item "Qualquer km". */
const ANY_KM = "qualquer";

/** Valor do item "sem outro estado" da comparação. */
const NO_COMPARE_STATE = "nenhum";

const STATES_BY_NAME = STATE_CODES.toSorted((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b], "pt-BR"));

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
  };
}

/**
 * Barra de filtros do Panorama (DESIGN.md §15.8, docs/PLANO-MERCADO.md §6): na linha fixa, o modelo, a categoria,
 * "Mais filtros" (gaveta com condição, estado, fonte, km e ano), a comparação e o total; embaixo, os filtros ativos em
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
        className="border-b border-border bg-surface pb-3 xl:sticky xl:top-0 xl:z-30 xl:py-2.5"
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
              <Button variant="secondary" className={cn("flex-1 md:flex-none", chips.length > 0 && activeTriggerClass)}>
                <SlidersHorizontal aria-hidden="true" />
                Mais filtros{chips.length > 0 ? ` (${chips.length})` : ""}
              </Button>
            </DialogTrigger>
            <DrawerContent side="right">
              <DialogHeader className="border-b border-border px-6 py-5">
                <DialogTitle>Mais filtros</DialogTitle>
                <DialogDescription className="sr-only">Cada escolha aplica na hora.</DialogDescription>
              </DialogHeader>
              <DrawerBody className="gap-5">
                <ConditionSelect
                  value={filters.condition}
                  counts={facets.conditions}
                  onChange={(condition) => apply({ ...filters, condition })}
                />
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
              </DrawerBody>
              <DrawerFooter>
                <Button
                  variant="secondary"
                  onClick={() => apply(withoutDrawerFilters(filters))}
                  disabled={chips.length === 0}
                >
                  Limpar estes filtros
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
            <ul aria-label="Filtros ativos" className="flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <li key={chip.id} className="flex max-w-full">
                  <RemovableChip
                    removeLabel={`Remover filtro ${chip.label}`}
                    onRemove={() => apply(chip.without, { focusStatus: true })}
                  >
                    {chip.label}
                  </RemovableChip>
                </li>
              ))}
            </ul>
          ) : null}
          {showCompare ? (
            <div id={compareRowId} className="grid gap-3 md:flex md:flex-wrap md:items-center">
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
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const activeTriggerClass = "border-accent bg-accent-subtle text-accent-hover";

/** Rótulo visível sobre um campo da gaveta. */
function DrawerField({ labelId, label, children }: { labelId: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-label text-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function ConditionSelect({
  value,
  counts,
  onChange,
}: {
  value: ResearchCondition;
  counts: ResearchFacets["conditions"];
  onChange: (condition: ResearchCondition) => void;
}) {
  const labelId = useId();
  return (
    <DrawerField labelId={labelId} label="Condição">
      <Select
        value={value}
        onValueChange={(next) => {
          const condition = RESEARCH_CONDITIONS.find((key) => key === next);
          if (condition) onChange(condition);
        }}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{CONDITION_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {RESEARCH_CONDITIONS.map((condition) => (
            <SelectItem key={condition} value={condition} disabled={counts[condition] === 0 && condition !== value}>
              <OptionWithCount label={CONDITION_LABELS[condition]} count={counts[condition]} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DrawerField>
  );
}

/** Estado das vendas (o mapa também escolhe). */
function StateSelect({
  value,
  counts,
  onChange,
}: {
  value: StateCode | null;
  counts: ResearchFacets["states"];
  onChange: (state: StateCode | null) => void;
}) {
  const labelId = useId();
  return (
    <DrawerField labelId={labelId} label="Estado">
      <Select
        value={value ?? ALL_STATES}
        onValueChange={(next) => {
          if (next === ALL_STATES) onChange(null);
          else if (isStateCode(next)) onChange(next);
        }}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{value === null ? "Todo o Brasil" : STATE_NAMES[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATES}>Todo o Brasil</SelectItem>
          {STATES_BY_NAME.map((code) => (
            <SelectItem key={code} value={code} disabled={(counts[code] ?? 0) === 0 && code !== value}>
              <OptionWithCount label={STATE_NAMES[code]} count={counts[code] ?? 0} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DrawerField>
  );
}

/** Ano-modelo inicial ou final. A lista traz os anos com venda e o escolhido, mesmo que o resto do filtro o esvazie. */
function YearSelect({
  label,
  short,
  value,
  years,
  onChange,
}: {
  /** Nome completo, para leitores de tela. */
  label: string;
  /** Texto curto no campo: sem ano ("Ano inicial") e com ano ("De 2018"). */
  short: { empty: string; prefix: string };
  value: number | null;
  years: ResearchFacets["years"];
  onChange: (year: number | null) => void;
}) {
  const labelId = useId();
  const options =
    value === null || years.some(({ year }) => year === value) ? years : [{ year: value, sales: 0 }, ...years];
  return (
    <DrawerField labelId={labelId} label={label}>
      <Select
        value={value === null ? ALL_YEARS : String(value)}
        onValueChange={(next) => onChange(next === ALL_YEARS ? null : Number(next))}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{value === null ? short.empty : `${short.prefix} ${value}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_YEARS}>Todos os anos</SelectItem>
          {options.map(({ year, sales }) => (
            <SelectItem key={year} value={String(year)}>
              <OptionWithCount label={String(year)} count={sales} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DrawerField>
  );
}

/** Fonte (leiloeiro), com as vendas de cada uma; a escolhida fica na lista mesmo que o resto do filtro a esvazie. */
function SourceSelect({
  value,
  sources,
  onChange,
}: {
  value: string | null;
  sources: ResearchFacets["sources"];
  onChange: (source: string | null) => void;
}) {
  const labelId = useId();
  const options =
    value === null || sources.some(({ id }) => id === value)
      ? sources
      : [{ id: value, name: value, sales: 0 }, ...sources];
  const chosen = options.find(({ id }) => id === value);
  return (
    <DrawerField labelId={labelId} label="Fonte">
      <Select value={value ?? ALL_SOURCES} onValueChange={(next) => onChange(next === ALL_SOURCES ? null : next)}>
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{chosen ? chosen.name : "Todas as fontes"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SOURCES}>Todas as fontes</SelectItem>
          {options.map(({ id, name, sales }) => (
            <SelectItem key={id} value={id}>
              <OptionWithCount label={name} count={sales} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DrawerField>
  );
}

/** "Km até": com limite, vendas sem km informado saem; a lista diz quantas vendas têm km. */
function MileageSelect({
  value,
  mileage,
  onChange,
}: {
  value: ResearchFilters["maxKm"];
  mileage: ResearchFacets["mileage"];
  onChange: (maxKm: ResearchFilters["maxKm"]) => void;
}) {
  const labelId = useId();
  return (
    <DrawerField labelId={labelId} label="Quilometragem máxima">
      <Select
        value={value === null ? ANY_KM : String(value)}
        onValueChange={(next) => onChange(RESEARCH_MILEAGE_OPTIONS.find((option) => String(option) === next) ?? null)}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{value === null ? "Qualquer km" : `Até ${mileageLabel(value)}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_KM}>Qualquer km</SelectItem>
          {RESEARCH_MILEAGE_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              Até {mileageLabel(option)}
            </SelectItem>
          ))}
          <SelectGroup>
            <SelectLabel className="font-normal tabular-nums">
              {mileage.known.toLocaleString("pt-BR")} de {salesLabel(mileage.total)} têm km informado
            </SelectLabel>
          </SelectGroup>
        </SelectContent>
      </Select>
    </DrawerField>
  );
}

/** "Comparar com outro estado": o segundo grupo da comparação; o estado dos filtros não se repete na lista. */
function CompareStateSelect({
  value,
  current,
  counts,
  onChange,
}: {
  value: StateCode | null;
  current: StateCode | null;
  counts: ResearchFacets["states"];
  onChange: (state: StateCode | null) => void;
}) {
  const labelId = useId();
  return (
    <>
      <span id={labelId} className="sr-only">
        Comparar com outro estado
      </span>
      <Select value={value ?? NO_COMPARE_STATE} onValueChange={(next) => onChange(isStateCode(next) ? next : null)}>
        <SelectTrigger aria-labelledby={labelId} className="md:w-60">
          <SelectValue>{value === null ? "Outro estado" : STATE_NAMES[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_COMPARE_STATE}>{current === null ? "Nenhum estado" : "Sem outro estado"}</SelectItem>
          {STATES_BY_NAME.filter((code) => code !== current).map((code) => (
            <SelectItem key={code} value={code} disabled={(counts[code] ?? 0) === 0 && code !== value}>
              <OptionWithCount label={STATE_NAMES[code]} count={counts[code] ?? 0} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function OptionWithCount({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex w-full items-center justify-between gap-4">
      {label}
      <span className="text-caption text-muted tabular-nums">{count.toLocaleString("pt-BR")}</span>
    </span>
  );
}
