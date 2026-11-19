"use client";

import { Car, Motorbike, Package, Recycle, Truck, Van } from "lucide-react";
import { useId } from "react";

import { Checkbox, SegmentedControl, ToggleChip } from "@/components/ui";
import {
  CATEGORY_KEYS,
  type CategoryKey,
  CONDITION_KEYS,
  DEFAULT_CATEGORIES,
  FUEL_KEYS,
  HIDE_KEYS,
  MILEAGE_OPTIONS_KM,
  ORIGIN_KEYS,
  RADIUS_OPTIONS_KM,
} from "@/domain/listings/criteria";
import type { ListingFacets } from "@/domain/listings/facets";

import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  formatKm,
  FUEL_LABELS,
  HIDE_LABELS,
  ORIGIN_LABELS,
} from "../../filter-labels";
import { ANY_OPTION, type CriteriaControlProps } from "./criteria-types";

type Counts<K extends string> = Partial<Record<K, number>> | undefined;

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
      value={criteria.maxMileageKm === null ? ANY_OPTION : String(criteria.maxMileageKm)}
      options={[
        { value: ANY_OPTION, label: "Qualquer" },
        ...MILEAGE_OPTIONS_KM.map((km) => ({ value: String(km), label: `Até ${formatKm(km)}` })),
      ]}
      onValueChange={(value) => onChange({ maxMileageKm: value === ANY_OPTION ? null : Number(value) })}
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
