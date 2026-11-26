"use client";

import { CalendarRange, ChevronDown, MapPin, SlidersHorizontal, Wallet } from "lucide-react";

import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
} from "@/components/ui";
import { DEFAULT_RADIUS_KM, type ListingCriteria } from "@/domain/listings/criteria";
import { cn } from "@/lib/utils";

import { distanceLabel, ENDS_WITHIN_LABELS, priceRangeLabel, yearRangeLabel } from "../../filter-labels";
import { ENDS_WITHIN_KEYS, type ListingFilters } from "../../schemas";
import type { ListingFacetsView } from "../../types";
import {
  CategoryField,
  ConditionFields,
  DistanceField,
  FuelField,
  KeyField,
  MileageField,
  OriginField,
  PriceFields,
  SourceField,
  YearFields,
} from "./criteria-controls";

/** Onde a barra está: muda o que se conta (lotes ou leilões) e o que faz sentido mostrar. */
export type FilterBarScope = "auctions" | "listings" | "auction";

const activeTriggerClass = "border-accent bg-accent-subtle text-accent-hover";

const priceLabel = (criteria: ListingCriteria) => {
  const range = priceRangeLabel(criteria);
  const market = criteria.maxMarketPct === null ? null : `≤ ${criteria.maxMarketPct}% mercado`;
  return [range, market].filter(Boolean).join(" · ") || null;
};

/** Botão de popover que mostra o valor escolhido no lugar do nome ("Até R$ 30 mil"). */
function FilterTrigger({
  icon,
  label,
  value,
  active = value !== null,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  active?: boolean;
}) {
  return (
    <PopoverTrigger asChild>
      <Button variant="secondary" className={cn("max-w-72", active && activeTriggerClass)}>
        {icon}
        <span className="truncate">
          {value === null ? (
            label
          ) : (
            <>
              <span className="sr-only">{label}: </span>
              {value}
            </>
          )}
        </span>
        <ChevronDown aria-hidden="true" className="text-muted" />
      </Button>
    </PopoverTrigger>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-b border-border pb-7 last:border-b-0 last:pb-0">
      <h3 className="text-heading-3 text-foreground">{title}</h3>
      {children}
    </section>
  );
}

type ListingFilterDrawersProps = {
  filters: ListingFilters;
  scope: FilterBarScope;
  facets: ListingFacetsView;
  regionLabel: string;
  defaultRadiusKm?: number;
  currentYear: number;
  countText: string;
  isPending: boolean;
  moreCount: number;
  mobileCount: number;
  hasChips: boolean;
  onApply: (next: ListingFilters) => void;
  onApplyCriteria: (patch: Partial<ListingCriteria>) => void;
  onClearAll: () => void;
};

/** Popovers do desktop e gavetas lateral (desktop) e inferior (celular) da barra de Leilões. */
export function ListingFilterDrawers({
  filters,
  scope,
  facets,
  regionLabel,
  defaultRadiusKm = DEFAULT_RADIUS_KM,
  currentYear,
  countText,
  isPending,
  moreCount,
  mobileCount,
  hasChips,
  onApply,
  onApplyCriteria,
  onClearAll,
}: ListingFilterDrawersProps) {
  const { criteria } = filters;
  const control = { criteria, onChange: onApplyCriteria };

  const moreFilters = (
    <>
      <FilterSection title="Veículo">
        <CategoryField {...control} counts={facets.categories} />
        <FuelField {...control} counts={facets.fuels} />
        <MileageField {...control} />
        <KeyField {...control} />
      </FilterSection>
      <FilterSection title="Condição">
        <ConditionFields {...control} />
      </FilterSection>
      <FilterSection title="Leilão">
        {scope === "auction" ? null : <SourceField {...control} sources={facets.sources} />}
        <OriginField {...control} counts={facets.origins} />
        {filters.ended ? null : (
          <SegmentedControl
            label="Encerra em"
            value={filters.endsWithin ?? "qualquer"}
            options={[
              { value: "qualquer", label: "Qualquer" },
              ...ENDS_WITHIN_KEYS.map((key) => ({ value: key, label: ENDS_WITHIN_LABELS[key] })),
            ]}
            onValueChange={(value) =>
              onApply({ ...filters, endsWithin: ENDS_WITHIN_KEYS.find((key) => key === value) ?? null })
            }
          />
        )}
        <SegmentedControl
          label="Lances"
          value={filters.bids ?? "qualquer"}
          options={[
            { value: "qualquer", label: "Qualquer" },
            { value: "com", label: "Com lances" },
            { value: "sem", label: "Sem lances" },
          ]}
          onValueChange={(value) => onApply({ ...filters, bids: value === "qualquer" ? null : value })}
        />
        <Checkbox
          label="Só novos (últimas 24 h)"
          description="Lotes que o coletor encontrou pela primeira vez nas últimas 24 horas."
          checked={filters.newOnly}
          onCheckedChange={(checked) => onApply({ ...filters, newOnly: checked === true })}
        />
      </FilterSection>
      <FilterSection title="Minhas análises">
        <SegmentedControl
          label="Lotes que já levei para análise"
          value={filters.analyzed ?? "mostrar"}
          options={[
            { value: "mostrar", label: "Mostrar" },
            { value: "esconder", label: "Esconder" },
            { value: "so", label: "Só eles" },
          ]}
          onValueChange={(value) => onApply({ ...filters, analyzed: value === "mostrar" ? null : value })}
        />
      </FilterSection>
    </>
  );

  const drawerFooter = (
    <DrawerFooter>
      <Button variant="secondary" onClick={onClearAll} disabled={!hasChips}>
        Limpar tudo
      </Button>
      <DialogClose asChild>
        <Button aria-live="polite">{isPending ? "Atualizando…" : `Ver ${countText}`}</Button>
      </DialogClose>
    </DrawerFooter>
  );

  return (
    <>
      {/* Desktop: os filtros mais usados em popovers, o resto na gaveta lateral. */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <Popover>
          <FilterTrigger icon={<Wallet aria-hidden="true" />} label="Preço" value={priceLabel(criteria)} />
          <PopoverContent className="w-96">
            <PriceFields {...control} />
          </PopoverContent>
        </Popover>
        <Popover>
          <FilterTrigger icon={<CalendarRange aria-hidden="true" />} label="Ano" value={yearRangeLabel(criteria)} />
          <PopoverContent className="w-96">
            <YearFields {...control} currentYear={currentYear} />
          </PopoverContent>
        </Popover>
        <Popover>
          <FilterTrigger
            icon={<MapPin aria-hidden="true" />}
            label="Distância"
            value={distanceLabel(criteria.radiusKm)}
            active={criteria.radiusKm !== defaultRadiusKm}
          />
          <PopoverContent className="w-96">
            <DistanceField {...control} regionLabel={regionLabel} defaultRadiusKm={defaultRadiusKm} />
          </PopoverContent>
        </Popover>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" className={cn(moreCount > 0 && activeTriggerClass)}>
              <SlidersHorizontal aria-hidden="true" />
              Mais filtros{moreCount > 0 ? ` (${moreCount})` : ""}
            </Button>
          </DialogTrigger>
          <DrawerContent side="right">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle>Mais filtros</DialogTitle>
              <DialogDescription className="sr-only">Cada escolha aplica na hora.</DialogDescription>
            </DialogHeader>
            <DrawerBody>{moreFilters}</DrawerBody>
            {drawerFooter}
          </DrawerContent>
        </Dialog>
      </div>

      {/* Celular: um botão abre a gaveta inferior com todos os filtros. */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" className={cn("w-full md:hidden", mobileCount > 0 && activeTriggerClass)}>
            <SlidersHorizontal aria-hidden="true" />
            Filtros{mobileCount > 0 ? ` (${mobileCount})` : ""}
          </Button>
        </DialogTrigger>
        <DrawerContent side="bottom">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription className="sr-only">Cada escolha aplica na hora.</DialogDescription>
          </DialogHeader>
          <DrawerBody>
            <FilterSection title="Preço">
              <PriceFields {...control} />
            </FilterSection>
            <FilterSection title="Ano">
              <YearFields {...control} currentYear={currentYear} />
            </FilterSection>
            <FilterSection title="Distância">
              <DistanceField {...control} regionLabel={regionLabel} defaultRadiusKm={defaultRadiusKm} />
            </FilterSection>
            {moreFilters}
          </DrawerBody>
          {drawerFooter}
        </DrawerContent>
      </Dialog>
    </>
  );
}
