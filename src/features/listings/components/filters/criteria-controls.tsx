"use client";

import { Car, Motorbike, Package, Recycle, Truck, Van } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";

import { Checkbox, Input, SegmentedControl, Slider, ToggleChip } from "@/components/ui";
import {
  CATEGORY_KEYS,
  type CategoryKey,
  CONDITION_KEYS,
  DEFAULT_CATEGORIES,
  FUEL_KEYS,
  HIDE_KEYS,
  type ListingCriteria,
  MARKET_PCT_OPTIONS,
  MILEAGE_OPTIONS_KM,
  ORIGIN_KEYS,
  RADIUS_OPTIONS_KM,
} from "@/domain/listings/criteria";
import type { ListingFacets } from "@/domain/listings/facets";
import { cents } from "@/domain/money";
import { cn } from "@/lib/utils";

import {
  CATEGORY_LABELS,
  compactBRL,
  CONDITION_LABELS,
  formatKm,
  FUEL_LABELS,
  HIDE_LABELS,
  ORIGIN_LABELS,
} from "../../filter-labels";

/**
 * Controles dos critérios comuns (docs/PLANO-FILTROS.md §2), usados na barra de filtros, na gaveta e no formulário do
 * monitor. Cada um recebe os critérios atuais e devolve só o que mudou; quem usa decide se aplica na hora (barra) ou
 * guarda no formulário (monitor). Contagens são opcionais: sem elas, os chips não mostram número.
 */
export type CriteriaControlProps = {
  criteria: ListingCriteria;
  onChange: (patch: Partial<ListingCriteria>) => void;
};

type Counts<K extends string> = Partial<Record<K, number>> | undefined;

const ANY = "qualquer";

// ---------------------------------------------------------------------------------------------------------------
// Preço

/** Escala da faixa em reais: passos finos onde está a maioria dos lotes, largos no alto. A ponta direita é "sem limite". */
export const PRICE_STEPS = [
  0, 1_000, 2_000, 3_000, 4_000, 5_000, 7_500, 10_000, 12_500, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 60_000,
  80_000, 100_000, 150_000, 200_000,
] as const;
const LAST_STEP = PRICE_STEPS.length;

/** Índice do passo mais próximo do valor (centavos); sem valor, as pontas. */
function stepIndex(value: number | null, end: "min" | "max"): number {
  if (value === null) return end === "min" ? 0 : LAST_STEP;
  const reais = value / 100;
  let best = 0;
  PRICE_STEPS.forEach((step, index) => {
    if (Math.abs(step - reais) < Math.abs((PRICE_STEPS[best] ?? 0) - reais)) best = index;
  });
  return best;
}

const stepCents = (index: number) => {
  const step = PRICE_STEPS[index];
  return step === undefined || step === 0 ? null : cents(step * 100);
};
const stepText = (index: number, end: "min" | "max") => {
  const value = stepCents(index);
  if (index === LAST_STEP) return "Sem limite";
  return value === null ? (end === "min" ? "R$ 0" : "Sem limite") : compactBRL(value);
};

/** Faixa de preço (dois pontos) com os valores exatos e o teto frente ao valor de mercado. */
export function PriceFields({ criteria, onChange }: CriteriaControlProps) {
  const committed: [number, number] = [stepIndex(criteria.minPrice, "min"), stepIndex(criteria.maxPrice, "max")];
  const committedKey = `${criteria.minPrice}-${criteria.maxPrice}`;
  const [range, setRange] = useState(committed);
  const [synced, setSynced] = useState(committedKey);
  // Valor mudou fora daqui (chip, "Limpar", campo exato): a faixa acompanha.
  if (synced !== committedKey) {
    setSynced(committedKey);
    setRange(committed);
  }
  const [low, high] = range;

  function commitRange([nextLow, nextHigh]: number[]) {
    if (nextLow === undefined || nextHigh === undefined) return;
    onChange({ minPrice: stepCents(nextLow), maxPrice: nextHigh === LAST_STEP ? null : stepCents(nextHigh) });
  }

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-label text-foreground">Preço</legend>
        <p className="text-caption text-muted">Lance atual ou, sem lance, o inicial.</p>
        <Slider
          min={0}
          max={LAST_STEP}
          step={1}
          minStepsBetweenThumbs={1}
          value={range}
          onValueChange={(next) => {
            const [nextLow, nextHigh] = next;
            if (nextLow !== undefined && nextHigh !== undefined) setRange([nextLow, nextHigh]);
          }}
          onValueCommit={commitRange}
          thumbLabels={["Preço mínimo", "Preço máximo"]}
          thumbValueTexts={[stepText(low, "min"), stepText(high, "max")]}
        />
        <div aria-hidden="true" className="flex justify-between text-caption text-muted tabular-nums">
          <span>{stepText(low, "min")}</span>
          <span>{stepText(high, "max")}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ReaisInput
            label="Mínimo (R$)"
            value={criteria.minPrice}
            onCommit={(minPrice) => onChange({ minPrice })}
            placeholder="Sem mínimo"
          />
          <ReaisInput
            label="Máximo (R$)"
            value={criteria.maxPrice}
            onCommit={(maxPrice) => onChange({ maxPrice })}
            placeholder="Sem limite"
          />
        </div>
      </fieldset>
      <MarketPctField criteria={criteria} onChange={onChange} />
    </div>
  );
}

/** Campo em reais inteiros que aplica ao sair do campo ou com Enter (não a cada tecla). */
function ReaisInput({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: number | null;
  onCommit: (value: ReturnType<typeof cents> | null) => void;
  placeholder: string;
}) {
  const shown = value === null ? "" : String(Math.round(value / 100));
  const [text, setText] = useState(shown);
  const [synced, setSynced] = useState(shown);
  if (synced !== shown) {
    setSynced(shown);
    setText(shown);
  }

  function commit() {
    const digits = text.replace(/\D/g, "");
    const reais = digits === "" ? null : Number(digits);
    const next = reais === null || reais === 0 ? null : cents(Math.min(reais, 100_000_000) * 100);
    if (next !== value) onCommit(next);
    else setText(shown);
  }

  return (
    <Input
      label={label}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

export function MarketPctField({ criteria, onChange }: CriteriaControlProps) {
  return (
    <div className="grid gap-2">
      <SegmentedControl
        label="Até quanto do valor de mercado"
        value={criteria.maxMarketPct === null ? ANY : String(criteria.maxMarketPct)}
        options={[
          { value: ANY, label: "Qualquer" },
          ...MARKET_PCT_OPTIONS.map((pct) => ({ value: String(pct), label: `${pct}%` })),
        ]}
        onValueChange={(value) => onChange({ maxMarketPct: value === ANY ? null : Number(value) })}
      />
      <p className="text-caption text-muted">
        Valor de mercado informado pela fonte (Leilo e Pátio). Lotes sem ele ficam de fora.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Ano

/**
 * Grade de anos: o primeiro clique escolhe um ano; o segundo, o outro extremo da faixa. Com uma faixa já escolhida,
 * o clique recomeça. Clicar de novo no ano único limpa.
 */
export function YearFields({ criteria, onChange, currentYear }: CriteriaControlProps & { currentYear: number }) {
  const years = Array.from({ length: currentYear + 2 - 1990 }, (_, index) => currentYear + 1 - index);
  const { yearFrom, yearTo } = criteria;
  const single = yearFrom !== null && yearFrom === yearTo ? yearFrom : null;

  function pick(year: number) {
    if (single === year) onChange({ yearFrom: null, yearTo: null });
    else if (single !== null) onChange({ yearFrom: Math.min(single, year), yearTo: Math.max(single, year) });
    else onChange({ yearFrom: year, yearTo: year });
  }

  const inRange = (year: number) =>
    (yearFrom !== null || yearTo !== null) && year >= (yearFrom ?? 0) && year <= (yearTo ?? 9999);

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-label text-foreground">Ano do modelo</legend>
      <p className="text-caption text-muted">
        {single !== null
          ? "Toque em outro ano para fazer uma faixa."
          : "Toque num ano e depois no outro extremo da faixa."}
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Até 5 anos", from: currentYear - 4 },
          { label: "Até 10 anos", from: currentYear - 9 },
        ].map((shortcut) => (
          <ToggleChip
            key={shortcut.label}
            pressed={yearFrom === shortcut.from && yearTo === null}
            onPressedChange={(pressed) => onChange({ yearFrom: pressed ? shortcut.from : null, yearTo: null })}
          >
            {shortcut.label}
          </ToggleChip>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-6">
        {years.map((year) => {
          const selected = inRange(year);
          const edge = year === yearFrom || year === yearTo;
          return (
            <button
              key={year}
              type="button"
              aria-pressed={selected}
              onClick={() => pick(year)}
              className={cn(
                "flex min-h-10 items-center justify-center rounded-md text-caption tabular-nums transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-accent",
                edge
                  ? "bg-primary font-semibold text-white"
                  : selected
                    ? "bg-accent-subtle font-medium text-accent-hover"
                    : "text-foreground-secondary hover:bg-surface-subtle hover:text-foreground",
              )}
            >
              {year}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <YearInput label="Ano de" value={yearFrom} onCommit={(value) => onChange({ yearFrom: value })} />
        <YearInput label="Ano até" value={yearTo} onCommit={(value) => onChange({ yearTo: value })} />
      </div>
    </fieldset>
  );
}

/** Ano exato (anos fora da grade, como 1985), aplicado ao sair do campo ou com Enter. */
function YearInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  const shown = value === null ? "" : String(value);
  const [text, setText] = useState(shown);
  const [synced, setSynced] = useState(shown);
  if (synced !== shown) {
    setSynced(shown);
    setText(shown);
  }

  function commit() {
    const year = Number(text);
    const next = text.trim() === "" ? null : Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : value;
    if (next !== value) onCommit(next);
    else setText(shown);
  }

  return (
    <Input
      label={label}
      inputMode="numeric"
      autoComplete="off"
      placeholder="Qualquer"
      maxLength={4}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Distância, quilometragem, condição

export function DistanceField({ criteria, onChange, regionLabel }: CriteriaControlProps & { regionLabel: string }) {
  return (
    <SegmentedControl
      label={`Distância de ${regionLabel}`}
      value={criteria.radiusKm === null ? "todas" : String(criteria.radiusKm)}
      options={[
        ...RADIUS_OPTIONS_KM.map((km) => ({ value: String(km), label: `${km} km` })),
        { value: "todas", label: "Qualquer" },
      ]}
      onValueChange={(value) => onChange({ radiusKm: value === "todas" ? null : Number(value) })}
    />
  );
}

export function MileageField({ criteria, onChange }: CriteriaControlProps) {
  return (
    <SegmentedControl
      label="Quilometragem"
      value={criteria.maxMileageKm === null ? ANY : String(criteria.maxMileageKm)}
      options={[
        { value: ANY, label: "Qualquer" },
        ...MILEAGE_OPTIONS_KM.map((km) => ({ value: String(km), label: `Até ${formatKm(km)}` })),
      ]}
      onValueChange={(value) => onChange({ maxMileageKm: value === ANY ? null : Number(value) })}
    />
  );
}

/** Escala da monta declarada, da mais restrita à mais ampla, e os alertas que dá para esconder. */
export function ConditionFields({ criteria, onChange }: CriteriaControlProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <SegmentedControl
          label="Monta declarada"
          value={criteria.condition}
          options={CONDITION_KEYS.map((key) => ({ value: key, label: CONDITION_LABELS[key] }))}
          onValueChange={(condition) => onChange({ condition })}
        />
        <p className="text-caption text-muted">
          Como o leiloeiro declara. A maioria dos lotes não informa monta e entra em &quot;Sem monta&quot;.
        </p>
      </div>
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-label text-foreground">Esconder lotes com</legend>
        <div className="grid sm:grid-cols-2">
          {HIDE_KEYS.map((key) => (
            <Checkbox
              key={key}
              label={HIDE_LABELS[key]}
              checked={criteria.hide.includes(key)}
              onCheckedChange={(checked) => onChange({ hide: toggle(HIDE_KEYS, criteria.hide, key, checked === true) })}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function KeyField({ criteria, onChange }: CriteriaControlProps) {
  return (
    <Checkbox
      label="Só com chave"
      description="Lotes em que a fonte informa que a chave está com o veículo."
      checked={criteria.keyOnly}
      onCheckedChange={(checked) => onChange({ keyOnly: checked === true })}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Chips de escolha múltipla

const CATEGORY_ICONS = {
  carros: Car,
  motos: Motorbike,
  utilitarios: Van,
  pesados: Truck,
  sucatas: Recycle,
  outros: Package,
} satisfies Record<CategoryKey, typeof Car>;

/** Categorias: "Todas" ou as marcadas. Desmarcar a última volta para "Todas". */
export function CategoryField({
  criteria,
  onChange,
  counts,
}: CriteriaControlProps & { counts?: ListingFacets["categories"] }) {
  const selected = criteria.categories ?? [];
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined;
  return (
    <ChipGroup label="Categoria">
      <ToggleChip
        pressed={criteria.categories === null}
        onPressedChange={(pressed) => onChange({ categories: pressed ? null : DEFAULT_CATEGORIES })}
        count={total}
      >
        Todas
      </ToggleChip>
      {CATEGORY_KEYS.map((key) => {
        const Icon = CATEGORY_ICONS[key];
        return (
          <ToggleChip
            key={key}
            pressed={selected.includes(key)}
            onPressedChange={(pressed) => {
              const next = toggle(CATEGORY_KEYS, selected, key, pressed);
              onChange({ categories: next.length === 0 ? null : next });
            }}
            icon={<Icon aria-hidden="true" />}
            count={counts?.[key]}
          >
            {CATEGORY_LABELS[key]}
          </ToggleChip>
        );
      })}
    </ChipGroup>
  );
}

export function FuelField({
  criteria,
  onChange,
  counts,
}: CriteriaControlProps & { counts?: Counts<(typeof FUEL_KEYS)[number]> }) {
  return (
    <ChipGroup label="Combustível">
      {FUEL_KEYS.map((key) => (
        <ToggleChip
          key={key}
          pressed={criteria.fuels.includes(key)}
          onPressedChange={(pressed) => onChange({ fuels: toggle(FUEL_KEYS, criteria.fuels, key, pressed) })}
          count={counts?.[key]}
        >
          {FUEL_LABELS[key]}
        </ToggleChip>
      ))}
    </ChipGroup>
  );
}

export function OriginField({
  criteria,
  onChange,
  counts,
}: CriteriaControlProps & { counts?: Counts<(typeof ORIGIN_KEYS)[number]> }) {
  return (
    <ChipGroup
      label="Origem do veículo"
      hint="Recuperado de financiamento, de seguradora ou frota, como a fonte informa."
    >
      {ORIGIN_KEYS.map((key) => (
        <ToggleChip
          key={key}
          pressed={criteria.origins.includes(key)}
          onPressedChange={(pressed) => onChange({ origins: toggle(ORIGIN_KEYS, criteria.origins, key, pressed) })}
          count={counts?.[key]}
        >
          {ORIGIN_LABELS[key]}
        </ToggleChip>
      ))}
    </ChipGroup>
  );
}

export function SourceField({
  criteria,
  onChange,
  sources,
}: CriteriaControlProps & { sources: readonly { id: string; name: string; count?: number }[] }) {
  const ids = sources.map((source) => source.id);
  return (
    <ChipGroup label="Site do leilão">
      {sources.map((source) => (
        <ToggleChip
          key={source.id}
          pressed={criteria.sources.includes(source.id)}
          onPressedChange={(pressed) => onChange({ sources: toggle(ids, criteria.sources, source.id, pressed) })}
          count={source.count}
        >
          {source.name}
        </ToggleChip>
      ))}
    </ChipGroup>
  );
}

function ChipGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const hintId = useId();
  return (
    <fieldset className="grid gap-2" aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-2 text-label text-foreground">{label}</legend>
      {hint ? (
        <p id={hintId} className="-mt-1 text-caption text-muted">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** Marca ou desmarca `key`, mantendo a ordem de `keys` (a URL fica estável). */
function toggle<K extends string>(keys: readonly K[], selected: readonly K[], key: K, on: boolean): K[] {
  return keys.filter((item) => (item === key ? on : selected.includes(item)));
}
