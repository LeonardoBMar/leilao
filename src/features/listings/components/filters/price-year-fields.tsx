"use client";

import { type KeyboardEvent, useState } from "react";

import { Input, SegmentedControl, Slider, ToggleChip } from "@/components/ui";
import { type ListingCriteria, MARKET_PCT_OPTIONS } from "@/domain/listings/criteria";
import { cents } from "@/domain/money";
import { cn } from "@/lib/utils";

import { compactBRL } from "../../filter-labels";
import { ANY_OPTION, type CriteriaControlProps } from "./criteria-types";

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
  // Ponto não arrastado mostra o valor gravado (que pode ser exato, digitado no campo), não o passo mais próximo.
  const lowText =
    low === committed[0] && criteria.minPrice !== null ? compactBRL(criteria.minPrice) : stepText(low, "min");
  const highText =
    high === committed[1] && criteria.maxPrice !== null ? compactBRL(criteria.maxPrice) : stepText(high, "max");

  // Grava só o ponto que mudou: o outro guarda o valor exato.
  function commitRange([nextLow, nextHigh]: number[]) {
    if (nextLow === undefined || nextHigh === undefined) return;
    const patch: Partial<ListingCriteria> = {};
    if (nextLow !== committed[0]) patch.minPrice = stepCents(nextLow);
    if (nextHigh !== committed[1]) patch.maxPrice = nextHigh === LAST_STEP ? null : stepCents(nextHigh);
    if (Object.keys(patch).length > 0) onChange(patch);
  }

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-label text-foreground">Faixa de preço</legend>
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
          thumbValueTexts={[lowText, highText]}
        />
        <div aria-hidden="true" className="flex justify-between text-caption text-muted tabular-nums">
          <span>{lowText}</span>
          <span>{highText}</span>
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
        value={criteria.maxMarketPct === null ? ANY_OPTION : String(criteria.maxMarketPct)}
        options={[
          { value: ANY_OPTION, label: "Qualquer" },
          ...MARKET_PCT_OPTIONS.map((pct) => ({ value: String(pct), label: `${pct}%` })),
        ]}
        onValueChange={(value) => onChange({ maxMarketPct: value === ANY_OPTION ? null : Number(value) })}
      />
      <p className="text-caption text-muted">
        Valor de mercado da fonte ou, sem ele, da tabela FIPE casado pelo sistema. Lotes sem nenhum dos dois ficam de
        fora.
      </p>
    </div>
  );
}

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
