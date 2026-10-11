"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useRef } from "react";

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import {
  DEFAULT_RESEARCH_FILTERS,
  normalizeComparison,
  normalizeYears,
  RESEARCH_CATEGORIES,
  RESEARCH_CONDITIONS,
  RESEARCH_MILEAGE_OPTIONS,
  type ResearchFilters,
  vehicleLabel,
} from "@/domain/research/filters";
import { isStateCode, STATE_CODES, STATE_NAMES, type StateCode } from "@/domain/research/states";

import { CATEGORY_LABELS, CONDITION_LABELS, mileageLabel, salesLabel } from "../labels";
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

/**
 * Barra de filtros da Pesquisa (DESIGN.md §15.8): modelo, condição, categoria e estado (que o mapa também escolhe).
 * Cada escolha aplica na hora e vai para a URL; enquanto a tela recarrega, os controles já mostram a escolha.
 */
export function ResearchFilterBar({ params, facets }: ResearchFilterBarProps) {
  const router = useRouter();
  const conditionLabelId = useId();
  const categoryLabelId = useId();
  const stateLabelId = useId();
  // "Limpar tudo" some ao aplicar: o foco vai para o total, que anuncia o resultado.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const { isPending, startTransition } = useResearchTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parseResearchParams(params));
  const total = facets.conditions[filters.condition];
  const isDefault = Object.keys(params).length === 0;

  function apply(changed: ResearchFilters, { focusStatus = false } = {}) {
    // A comparação acompanha os filtros: outro modelo ou estado igual ao principal deixa de ser comparação.
    const next = { ...changed, compare: normalizeComparison(changed, changed.compare) };
    startTransition(() => {
      setOptimisticFilters(next);
      router.push(researchHref(next), { scroll: false });
    });
    if (focusStatus) statusRef.current?.focus();
  }

  return (
    // Fixa abaixo do cabeçalho do celular (3.5rem) a partir de `md`; no celular a barra é alta demais para ficar presa.
    <section
      aria-label="Filtros"
      className="grid gap-4 border-b border-border bg-surface pb-5 md:sticky md:top-14 md:z-30 md:pt-3 lg:top-0"
    >
      <div className="grid gap-3 md:flex md:flex-wrap md:items-center">
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
          className="md:min-w-64 md:flex-1"
        />
        <div className="grid grid-cols-2 gap-3 md:flex">
          <span id={conditionLabelId} className="sr-only">
            Condição
          </span>
          <Select
            value={filters.condition}
            onValueChange={(value) => {
              const condition = RESEARCH_CONDITIONS.find((key) => key === value);
              if (condition) apply({ ...filters, condition });
            }}
          >
            <SelectTrigger aria-labelledby={conditionLabelId} className="col-span-2 md:col-span-1 md:w-60">
              <SelectValue>{CONDITION_LABELS[filters.condition]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RESEARCH_CONDITIONS.map((condition) => (
                <SelectItem
                  key={condition}
                  value={condition}
                  disabled={facets.conditions[condition] === 0 && condition !== filters.condition}
                >
                  <OptionWithCount label={CONDITION_LABELS[condition]} count={facets.conditions[condition]} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <SelectTrigger aria-labelledby={categoryLabelId} className="md:w-44">
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
          <span id={stateLabelId} className="sr-only">
            Estado
          </span>
          <Select
            value={filters.state ?? ALL_STATES}
            onValueChange={(value) => {
              if (value === ALL_STATES) apply({ ...filters, state: null });
              else if (isStateCode(value)) apply({ ...filters, state: value });
            }}
          >
            <SelectTrigger aria-labelledby={stateLabelId} className="md:w-48">
              <SelectValue>{filters.state === null ? "Todo o Brasil" : STATE_NAMES[filters.state]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATES}>Todo o Brasil</SelectItem>
              {STATES_BY_NAME.map((code) => (
                <SelectItem
                  key={code}
                  value={code}
                  disabled={(facets.states[code] ?? 0) === 0 && code !== filters.state}
                >
                  <OptionWithCount label={STATE_NAMES[code]} count={facets.states[code] ?? 0} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:flex md:flex-wrap md:items-center">
        <span className="text-label text-muted">Comparar com</span>
        {filters.vehicle === null ? null : (
          <ModelPicker
            label="Comparar com outro modelo"
            placeholder="Outro modelo"
            shortcut={false}
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
          onChange={(state) => apply({ ...filters, compare: { vehicle: filters.compare?.vehicle ?? null, state } })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
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
        {filters.vehicle === null ? null : (
          <>
            <YearSelect
              label="Ano-modelo de"
              value={filters.yearFrom}
              years={facets.years}
              onChange={(yearFrom) => apply({ ...filters, ...normalizeYears(yearFrom, filters.yearTo) })}
            />
            <YearSelect
              label="Ano-modelo até"
              value={filters.yearTo}
              years={facets.years}
              onChange={(yearTo) => apply({ ...filters, ...normalizeYears(filters.yearFrom, yearTo) })}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
            `${salesLabel(total)} com esses filtros`
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
        <SectionIndex hasModel={filters.vehicle !== null} hasComparison={filters.compare !== null} />
      </div>
    </section>
  );
}

/** Âncoras dos blocos (DESIGN.md §15.8): a página é longa e cada bloco tem o seu `id`. */
function SectionIndex({ hasModel, hasComparison }: { hasModel: boolean; hasComparison: boolean }) {
  const sections = [
    { id: "pesquisa-condicao", label: "Condição" },
    ...(hasComparison ? [{ id: "pesquisa-comparacao", label: "Comparação" }] : []),
    { id: "pesquisa-estado", label: "Estado" },
    hasModel ? { id: "pesquisa-vendas", label: "Vendas do modelo" } : { id: "pesquisa-modelos", label: "Modelos" },
    { id: "pesquisa-lance", label: "Lance" },
  ];
  return (
    <nav aria-label="Seções da página" className="flex flex-wrap gap-x-4 gap-y-1 md:ml-auto">
      {sections.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className="inline-flex h-10 items-center rounded-sm text-label text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

/** Ano-modelo inicial ou final. A lista traz os anos com venda e o escolhido, mesmo que o resto do filtro o esvazie. */
function YearSelect({
  label,
  value,
  years,
  onChange,
}: {
  label: string;
  value: number | null;
  years: ResearchFacets["years"];
  onChange: (year: number | null) => void;
}) {
  const labelId = useId();
  const options =
    value === null || years.some(({ year }) => year === value) ? years : [{ year: value, sales: 0 }, ...years];
  return (
    <>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <Select
        value={value === null ? ALL_YEARS : String(value)}
        onValueChange={(next) => onChange(next === ALL_YEARS ? null : Number(next))}
      >
        <SelectTrigger aria-labelledby={labelId} className="md:w-48">
          <SelectValue>{value === null ? `${label}: todos` : `${label} ${value}`}</SelectValue>
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
    </>
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
    <>
      <span id={labelId} className="sr-only">
        Fonte
      </span>
      <Select value={value ?? ALL_SOURCES} onValueChange={(next) => onChange(next === ALL_SOURCES ? null : next)}>
        <SelectTrigger aria-labelledby={labelId} className="md:w-48">
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
    </>
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
    <>
      <span id={labelId} className="sr-only">
        Quilometragem máxima
      </span>
      <Select
        value={value === null ? ANY_KM : String(value)}
        onValueChange={(next) => onChange(RESEARCH_MILEAGE_OPTIONS.find((option) => String(option) === next) ?? null)}
      >
        <SelectTrigger aria-labelledby={labelId} className="md:w-44">
          <SelectValue>{value === null ? "Qualquer km" : `Até ${mileageLabel(value)}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_KM}>Qualquer km</SelectItem>
          {RESEARCH_MILEAGE_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              Até {mileageLabel(option)}
            </SelectItem>
          ))}
          <p className="px-2 py-1.5 text-caption text-muted tabular-nums">
            {mileage.known.toLocaleString("pt-BR")} de {salesLabel(mileage.total)} têm km informado
          </p>
        </SelectContent>
      </Select>
    </>
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
