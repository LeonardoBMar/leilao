"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useRef, useTransition } from "react";

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import {
  DEFAULT_RESEARCH_FILTERS,
  RESEARCH_CATEGORIES,
  RESEARCH_CONDITIONS,
  type ResearchFilters,
  vehicleLabel,
} from "@/domain/research/filters";
import { isStateCode, STATE_CODES, STATE_NAMES } from "@/domain/research/states";

import { CATEGORY_LABELS, CONDITION_LABELS, salesLabel } from "../labels";
import { parseResearchParams } from "../schemas";
import { researchHref } from "../search";
import type { ResearchFacets } from "../types";
import { ModelPicker } from "./model-picker";

/** Valor do item "Todo o Brasil": o `Select` não aceita valor vazio. */
const ALL_STATES = "todos";

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
  const [isPending, startTransition] = useTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parseResearchParams(params));
  const total = facets.conditions[filters.condition];
  const isDefault = Object.keys(params).length === 0;

  function apply(next: ResearchFilters, { focusStatus = false } = {}) {
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
            apply({ ...filters, vehicle: option === null ? null : { brand: option.brand, model: option.model } })
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
        <SectionIndex hasModel={filters.vehicle !== null} />
      </div>
    </section>
  );
}

/** Âncoras dos blocos (DESIGN.md §15.8): a página é longa e cada bloco tem o seu `id`. */
function SectionIndex({ hasModel }: { hasModel: boolean }) {
  const sections = [
    { id: "pesquisa-condicao", label: "Condição" },
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

function OptionWithCount({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex w-full items-center justify-between gap-4">
      {label}
      <span className="text-caption text-muted tabular-nums">{count.toLocaleString("pt-BR")}</span>
    </span>
  );
}
