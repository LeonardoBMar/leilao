"use client";

import { CalendarRange, ChevronDown, LoaderCircle, MapPin, Plus, SlidersHorizontal, Wallet } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useRef, useTransition } from "react";

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
  RemovableChip,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type { ListingCriteria } from "@/domain/listings/criteria";
import { SaveWatchButton } from "@/features/watches/components/save-watch-button";
import { MOTION_EXIT_TRANSITION, MOTION_LAYOUT_TRANSITION } from "@/lib/motion";
import { cn } from "@/lib/utils";

import {
  activeFilters,
  clearedFilters,
  distanceLabel,
  ENDS_WITHIN_LABELS,
  priceRangeLabel,
  sortLabel,
  yearRangeLabel,
} from "../../filter-labels";
import { ENDS_WITHIN_KEYS, type ListingFilters, listingParams, parseListingParams, SORT_KEYS } from "../../schemas";
import { withQuery } from "../../search";
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
import { SearchBox } from "./search-box";

/** Onde a barra está: muda o que se conta (lotes ou leilões) e o que faz sentido mostrar. */
export type FilterBarScope = "auctions" | "listings" | "auction";

type ListingFilterBarProps = {
  /** Filtros da URL na forma canônica (`listingParams`), já aplicados ao resultado. */
  params: Readonly<Record<string, string>>;
  basePath: string;
  scope: FilterBarScope;
  total: number;
  facets: ListingFacetsView;
  regionLabel: string;
  currentYear: number;
};

/** Filtros que ficam na barra (e não contam em "Mais filtros"). */
const BAR_FILTERS = ["busca", "preco", "mercado", "ano", "distancia"];

/**
 * Barra de filtros dos Leilões (docs/PLANO-FILTROS.md §2). Cada escolha aplica na hora e vai para a URL; enquanto a
 * tela recarrega, os controles já mostram a escolha (`useOptimistic`) e o total diz "Atualizando…".
 */
export function ListingFilterBar({
  params,
  basePath,
  scope,
  total,
  facets,
  regionLabel,
  currentYear,
}: ListingFilterBarProps) {
  const router = useRouter();
  const sortLabelId = useId();
  // Chip, atalho e "Limpar tudo" somem ao aplicar: o foco vai para o total, que anuncia o resultado.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const applyAndFocusStatus = (next: Parameters<typeof apply>[0]) => {
    apply(next);
    statusRef.current?.focus();
  };
  const [isPending, startTransition] = useTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parseListingParams(params));
  const { criteria } = filters;
  const sourceNames = Object.fromEntries(facets.sources.map((source) => [source.id, source.name]));
  const chips = activeFilters(filters, sourceNames);
  const moreCount = chips.filter((chip) => !BAR_FILTERS.includes(chip.id)).length;
  const mobileCount = chips.filter((chip) => chip.id !== "busca").length;

  function apply(next: ListingFilters) {
    const target = { ...next, page: 1 };
    startTransition(() => {
      setOptimisticFilters(target);
      router.push(withQuery(basePath, listingParams(target)), { scroll: false });
    });
  }
  const applyCriteria = (patch: Partial<ListingCriteria>) =>
    apply({ ...filters, criteria: { ...filters.criteria, ...patch } });
  const control = { criteria, onChange: applyCriteria };

  const unit = scope === "auctions" ? { one: "leilão", many: "leilões" } : { one: "lote", many: "lotes" };
  const countText = `${total.toLocaleString("pt-BR")} ${total === 1 ? unit.one : unit.many}`;
  const situation = filters.ended ? (total === 1 ? "encerrado" : "encerrados") : total === 1 ? "aberto" : "abertos";

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
              apply({ ...filters, endsWithin: ENDS_WITHIN_KEYS.find((key) => key === value) ?? null })
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
          onValueChange={(value) => apply({ ...filters, bids: value === "qualquer" ? null : value })}
        />
        <Checkbox
          label="Só novos (últimas 24 h)"
          description="Lotes que o coletor encontrou pela primeira vez nas últimas 24 horas."
          checked={filters.newOnly}
          onCheckedChange={(checked) => apply({ ...filters, newOnly: checked === true })}
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
          onValueChange={(value) => apply({ ...filters, analyzed: value === "mostrar" ? null : value })}
        />
      </FilterSection>
    </>
  );

  const drawerFooter = (
    <DrawerFooter>
      <Button variant="secondary" onClick={() => apply(clearedFilters(filters))} disabled={chips.length === 0}>
        Limpar tudo
      </Button>
      <DialogClose asChild>
        <Button aria-live="polite">{isPending ? "Atualizando…" : `Ver ${countText}`}</Button>
      </DialogClose>
    </DrawerFooter>
  );

  const shortcuts = [
    filters.ended || filters.endsWithin !== null
      ? null
      : { label: "Encerra em 48 h", next: { ...filters, endsWithin: "48h" as const } },
    criteria.condition !== "qualquer"
      ? null
      : { label: "Sem monta", next: { ...filters, criteria: { ...criteria, condition: "sem-monta" as const } } },
    criteria.maxMarketPct !== null
      ? null
      : { label: "Até 60% do mercado", next: { ...filters, criteria: { ...criteria, maxMarketPct: 60 } } },
    filters.newOnly ? null : { label: "Novos (24 h)", next: { ...filters, newOnly: true } },
  ].filter((shortcut) => shortcut !== null);

  return (
    <section aria-label="Filtros" className="grid gap-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={criteria.search}
          suggestions={facets.suggestions}
          onSearch={(search) => applyCriteria({ search })}
          className="w-full md:w-auto md:min-w-64 md:flex-1"
        />

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
              active={criteria.radiusKm !== 150}
            />
            <PopoverContent className="w-96">
              <DistanceField {...control} regionLabel={regionLabel} />
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
                <DistanceField {...control} regionLabel={regionLabel} />
              </FilterSection>
              {moreFilters}
            </DrawerBody>
            {drawerFooter}
          </DrawerContent>
        </Dialog>
      </div>

      {chips.length > 0 || shortcuts.length > 0 ? (
        <LayoutGroup>
          <div className="relative flex flex-wrap items-center gap-2">
            {chips.length > 0 ? (
              <ul aria-label="Filtros ativos" className="contents">
                <AnimatePresence mode="popLayout" initial={false}>
                  {chips.map((chip) => (
                    <motion.li
                      key={chip.id}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94, transition: MOTION_EXIT_TRANSITION }}
                      transition={MOTION_LAYOUT_TRANSITION}
                      className="flex max-w-full"
                    >
                      <RemovableChip
                        removeLabel={`Remover filtro ${chip.label}`}
                        onRemove={() => applyAndFocusStatus(chip.without)}
                      >
                        {chip.label}
                      </RemovableChip>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : null}
            <AnimatePresence mode="popLayout" initial={false}>
              {chips.length > 1 ? (
                <motion.div
                  key="clear-all"
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: MOTION_EXIT_TRANSITION }}
                  transition={MOTION_LAYOUT_TRANSITION}
                >
                  <Button
                    variant="link"
                    size="sm"
                    className="h-10 px-1"
                    onClick={() => applyAndFocusStatus(clearedFilters(filters))}
                  >
                    Limpar tudo
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
            {shortcuts.length > 0 ? (
              <ul aria-label="Atalhos de filtro" className="contents">
                <AnimatePresence mode="popLayout" initial={false}>
                  {shortcuts.map((shortcut) => (
                    <motion.li
                      key={shortcut.label}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94, transition: MOTION_EXIT_TRANSITION }}
                      transition={MOTION_LAYOUT_TRANSITION}
                      className="flex"
                    >
                      <button
                        type="button"
                        onClick={() => applyAndFocusStatus(shortcut.next)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-full border border-dashed border-control-border px-3 text-caption font-medium text-foreground-secondary transition-colors duration-120 outline-none hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <Plus aria-hidden="true" className="size-3.5" />
                        {shortcut.label}
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : null}
          </div>
        </LayoutGroup>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
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
            `${countText} ${situation}`
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Situação"
            hideLabel
            value={filters.ended ? "encerrados" : "abertos"}
            options={[
              { value: "abertos", label: "Abertos" },
              { value: "encerrados", label: "Encerrados" },
            ]}
            onValueChange={(value) => apply({ ...filters, ended: value === "encerrados" })}
            className="w-56"
          />
          {scope === "auctions" ? null : (
            <div className="flex items-center gap-2">
              <span id={sortLabelId} className="text-label text-foreground-secondary">
                Ordenar
              </span>
              <Select
                value={filters.sort}
                onValueChange={(value) => {
                  const sort = SORT_KEYS.find((key) => key === value);
                  if (sort) apply({ ...filters, sort });
                }}
              >
                <SelectTrigger aria-labelledby={sortLabelId} className="w-56">
                  <SelectValue>{sortLabel(filters.sort, filters.ended)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORT_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {sortLabel(key, filters.ended)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scope === "auction" ? null : (
            <SaveWatchButton query={new URLSearchParams(listingParams(filters)).toString()} />
          )}
        </div>
      </div>
    </section>
  );
}

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
