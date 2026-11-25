"use client";

import { type ReactNode, useId } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { RESEARCH_MILEAGE_OPTIONS, type ResearchFilters, type ResearchPeriod } from "@/domain/research/filters";
import { isStateCode, STATE_CODES, STATE_NAMES, type StateCode } from "@/domain/research/states";
import { formatInteger } from "@/lib/format";

import { mileageLabel, periodLabel, salesLabel } from "../../labels";
import type { ResearchFacets } from "../../types";

const ALL_STATES = "todos";
const ALL_YEARS = "todos";
const ALL_SOURCES = "todas";
const ANY_KM = "qualquer";
const ALL_PERIOD = "tudo";
const NO_COMPARE_STATE = "nenhum";

const STATES_BY_NAME = STATE_CODES.toSorted((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b], "pt-BR"));

export const researchActiveTriggerClass = "border-accent bg-accent-subtle text-accent-hover";

/** Rótulo visível sobre um campo da gaveta. */
export function DrawerField({ labelId, label, children }: { labelId: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-label text-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function OptionWithCount({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex w-full items-center justify-between gap-4">
      {label}
      <span className="text-caption text-muted tabular-nums">{formatInteger(count)}</span>
    </span>
  );
}

/** Estado das vendas (o mapa também escolhe). */
export function StateSelect({
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
export function YearSelect({
  label,
  short,
  value,
  years,
  onChange,
}: {
  label: string;
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
export function SourceSelect({
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
export function MileageSelect({
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
              {formatInteger(mileage.known)} de {salesLabel(mileage.total)} têm km informado
            </SelectLabel>
          </SelectGroup>
        </SelectContent>
      </Select>
    </DrawerField>
  );
}

/** Período das vendas (D-75): só os que a base já cobre, mais o escolhido. */
export function PeriodSelect({
  value,
  periods,
  onChange,
}: {
  value: ResearchPeriod | null;
  periods: readonly ResearchPeriod[];
  onChange: (period: ResearchPeriod | null) => void;
}) {
  const labelId = useId();
  const options = value === null || periods.includes(value) ? periods : [...periods, value];
  return (
    <DrawerField labelId={labelId} label="Período">
      <Select
        value={value === null ? ALL_PERIOD : String(value)}
        onValueChange={(next) => onChange(options.find((option) => String(option) === next) ?? null)}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{value === null ? "Todo o período" : periodLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_PERIOD}>Todo o período</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {periodLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DrawerField>
  );
}

/** "Comparar com outro estado": o segundo grupo da comparação; o estado dos filtros não se repete na lista. */
export function CompareStateSelect({
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
