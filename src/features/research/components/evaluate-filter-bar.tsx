"use client";

import { LoaderCircle, SlidersHorizontal, Target, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useState } from "react";

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { VEHICLE_ORIGINS } from "@/domain/listings/origin";
import { DEFAULT_EVALUATE_FILTERS, type EvaluateFilters } from "@/domain/research/evaluate";
import { normalizeYears, RESEARCH_CONDITIONS, RESEARCH_MILEAGE_OPTIONS, vehicleLabel } from "@/domain/research/filters";
import { ORIGIN_LABELS } from "@/features/listings/filter-labels";
import { cn } from "@/lib/utils";

import { CONDITION_LABELS, mileageLabel, salesLabel } from "../labels";
import { parseEvaluateParams } from "../schemas";
import { evaluateHref } from "../search";
import type { ResearchModelOption } from "../types";
import { ModelPicker } from "./model-picker";
import { useResearchTransition } from "./research-shell";

/** Valor do item "todos" de cada seletor: o `Select` não aceita valor vazio. */
const ALL = "todos";

type Option = { value: string; label: string; n: number };

/** Contagens dos seletores do recorte (cada uma sem a própria dimensão). */
export type EvaluateFacets = {
  families: Option[];
  versions: Option[];
  origins: Record<(typeof VEHICLE_ORIGINS)[number], number>;
  conditions: Record<(typeof RESEARCH_CONDITIONS)[number], number>;
  years: { year: number; n: number }[];
  /** Vendas na conta (sem as excluídas). */
  total: number;
};

type EvaluateFilterBarProps = {
  /** Recorte em vigor como parâmetros (o do lote, quando a URL só traz `lote`). */
  params: Readonly<Record<string, string>>;
  models: readonly ResearchModelOption[];
  /** `null` sem modelo escolhido. */
  facets: EvaluateFacets | null;
  /** Lote que serve de alvo, se houver. */
  lotLabel: string | null;
};

/**
 * Seletor do veículo do Avaliar (docs/PLANO-MERCADO.md §5.2): a busca do modelo e, com ele, família, versão FIPE, ano,
 * km, condição e origem, cada opção com as vendas que ela deixaria. Cada escolha vai para a URL; opção sem venda fica
 * desabilitada. Trocar o modelo recomeça o recorte (família, versão, ano e exclusões são de um modelo).
 */
export function EvaluateFilterBar({ params, models, facets, lotLabel }: EvaluateFilterBarProps) {
  const router = useRouter();
  const { isPending, startTransition } = useResearchTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parseEvaluateParams(params));
  // No celular, os seletores ficam atrás de "Refinar" para a resposta aparecer sem rolar (§5.2).
  const [refining, setRefining] = useState(false);
  const refineId = useId();
  const refinements = [
    filters.family,
    filters.version,
    filters.yearFrom,
    filters.yearTo,
    filters.maxKm,
    filters.origin,
    filters.condition === DEFAULT_EVALUATE_FILTERS.condition ? null : filters.condition,
  ].filter((value) => value !== null).length;

  function apply(next: EvaluateFilters) {
    startTransition(() => {
      setOptimisticFilters(next);
      router.push(evaluateHref(next), { scroll: false });
    });
  }

  return (
    <section aria-label="Veículo avaliado" className="grid gap-3 border-b border-border pb-4">
      {lotLabel === null || filters.lot === null ? null : (
        <p className="flex flex-wrap items-center gap-2 text-label text-foreground">
          <Target aria-hidden="true" className="size-4 text-muted" />
          Comparando com o {lotLabel}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Deixar de comparar com o lote"
            onClick={() => apply({ ...filters, lot: null })}
          >
            <X aria-hidden="true" />
          </Button>
        </p>
      )}
      <ModelPicker
        value={filters.vehicle === null ? null : vehicleLabel(filters.vehicle)}
        options={models}
        placeholder="Busque um modelo: onix, cg 160, hilux…"
        clearLabel="Escolher outro modelo"
        onChange={(option) =>
          apply({
            ...DEFAULT_EVALUATE_FILTERS,
            vehicle: option === null ? null : { brand: option.brand, model: option.model },
            condition: filters.condition,
          })
        }
        className="md:max-w-xl"
      />
      {facets === null || filters.vehicle === null ? null : (
        <>
          <Button
            variant="secondary"
            className="w-fit md:hidden"
            aria-expanded={refining}
            aria-controls={refineId}
            onClick={() => setRefining((open) => !open)}
          >
            <SlidersHorizontal aria-hidden="true" />
            {refining ? "Fechar refinamento" : "Refinar recorte"}
            {refinements > 0 ? <span className="text-muted tabular-nums">({refinements})</span> : null}
          </Button>
          <div id={refineId} className={cn("grid-cols-2 gap-3 md:flex md:flex-wrap", refining ? "grid" : "hidden")}>
            <CountSelect
              label="Família"
              allLabel="Todas as famílias"
              value={filters.family}
              options={facets.families}
              onChange={(family) => apply({ ...filters, family, version: null })}
            />
            {facets.versions.length === 0 && filters.version === null ? null : (
              <CountSelect
                label="Versão FIPE"
                allLabel="Todas as versões"
                value={filters.version}
                options={facets.versions}
                onChange={(version) => apply({ ...filters, version })}
                className="md:w-72"
              />
            )}
            <CountSelect
              label="Ano-modelo de"
              allLabel="Ano inicial"
              value={filters.yearFrom === null ? null : String(filters.yearFrom)}
              options={facets.years.map(({ year, n }) => ({ value: String(year), label: `De ${year}`, n }))}
              onChange={(year) =>
                apply({ ...filters, ...normalizeYears(year === null ? null : Number(year), filters.yearTo) })
              }
              className="md:w-40"
            />
            <CountSelect
              label="Ano-modelo até"
              allLabel="Ano final"
              value={filters.yearTo === null ? null : String(filters.yearTo)}
              options={facets.years.map(({ year, n }) => ({ value: String(year), label: `Até ${year}`, n }))}
              onChange={(year) =>
                apply({ ...filters, ...normalizeYears(filters.yearFrom, year === null ? null : Number(year)) })
              }
              className="md:w-40"
            />
            <CountSelect
              label="Quilometragem máxima"
              allLabel="Qualquer km"
              value={filters.maxKm === null ? null : String(filters.maxKm)}
              options={RESEARCH_MILEAGE_OPTIONS.map((km) => ({ value: String(km), label: `Até ${mileageLabel(km)}` }))}
              onChange={(km) =>
                apply({ ...filters, maxKm: RESEARCH_MILEAGE_OPTIONS.find((option) => String(option) === km) ?? null })
              }
              className="md:w-44"
            />
            <CountSelect
              label="Condição"
              value={filters.condition}
              options={RESEARCH_CONDITIONS.map((condition) => ({
                value: condition,
                label: CONDITION_LABELS[condition],
                n: facets.conditions[condition],
              }))}
              onChange={(value) =>
                apply({
                  ...filters,
                  condition: RESEARCH_CONDITIONS.find((key) => key === value) ?? DEFAULT_EVALUATE_FILTERS.condition,
                })
              }
              className="col-span-2 md:col-span-1 md:w-60"
            />
            <CountSelect
              label="Origem"
              allLabel="Qualquer origem"
              value={filters.origin}
              options={VEHICLE_ORIGINS.map((origin) => ({
                value: origin,
                label: ORIGIN_LABELS[origin],
                n: facets.origins[origin],
              }))}
              onChange={(value) => apply({ ...filters, origin: VEHICLE_ORIGINS.find((key) => key === value) ?? null })}
              className="col-span-2 md:col-span-1 md:w-52"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p role="status" className="flex items-center gap-2 text-label text-foreground tabular-nums">
              {isPending ? (
                <>
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-muted" />
                  <span className="text-muted">Atualizando…</span>
                </>
              ) : (
                `${salesLabel(facets.total)} no recorte`
              )}
            </p>
            <Button variant="link" size="sm" className="h-10 px-1" onClick={() => apply(DEFAULT_EVALUATE_FILTERS)}>
              Limpar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Seletor com a contagem de vendas de cada opção; opção sem venda fica desabilitada, menos a escolhida. Sem
 * `allLabel`, não há "todos" (a condição é sempre uma).
 */
function CountSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
  className = "md:w-56",
}: {
  label: string;
  allLabel?: string;
  value: string | null;
  options: readonly { value: string; label: string; n?: number }[];
  onChange: (value: string | null) => void;
  className?: string;
}) {
  const labelId = useId();
  const chosen = options.find((option) => option.value === value);
  return (
    <>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
        <SelectTrigger aria-labelledby={labelId} className={className}>
          <SelectValue>{chosen?.label ?? value ?? allLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allLabel === undefined ? null : <SelectItem value={ALL}>{allLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.n === 0 && option.value !== value}>
              <span className="flex w-full items-center justify-between gap-4">
                {option.label}
                {option.n === undefined ? null : (
                  <span className="text-caption text-muted tabular-nums">{option.n.toLocaleString("pt-BR")}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
