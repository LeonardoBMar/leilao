"use client";

import { LoaderCircle, SlidersHorizontal, Target, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useRef, useState } from "react";

import { ActiveFilterChips } from "@/components/layout/active-filter-chips";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { VEHICLE_ORIGINS } from "@/domain/listings/origin";
import { DEFAULT_EVALUATE_FILTERS, type EvaluateFilters, familyLabel } from "@/domain/research/evaluate";
import { normalizeYears, RESEARCH_CONDITIONS, RESEARCH_MILEAGE_OPTIONS, vehicleLabel } from "@/domain/research/filters";
import { ORIGIN_LABELS } from "@/features/listings/filter-labels";
import { cn } from "@/lib/utils";

import { CONDITION_LABELS, mileageLabel, salesLabel, yearRangeLabel } from "../labels";
import { parseEvaluateParams } from "../schemas";
import { evaluateHref } from "../search";
import { pickSharedQuery, rememberMarketContext } from "../tab-context";
import type { ResearchModelOption } from "../types";
import { DrawerField, OptionWithCount, researchActiveTriggerClass } from "./filters/research-filter-selects";
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

export type EvaluateLotContext = {
  id: string;
  label: string;
  details: string;
};

type EvaluateFilterBarProps = {
  /** Recorte em vigor como parâmetros (o do lote, quando a URL só traz `lote`). */
  params: Readonly<Record<string, string>>;
  models: readonly ResearchModelOption[];
  /** `null` sem modelo escolhido. */
  facets: EvaluateFacets | null;
  /** Lote que serve de alvo, se houver. */
  lotTarget: EvaluateLotContext | null;
};

type ActiveRefinement = { id: string; label: string; without: EvaluateFilters };

/** Refinamentos da gaveta fora do padrão, como chips removíveis. */
function activeRefinements(filters: EvaluateFilters, facets: EvaluateFacets): ActiveRefinement[] {
  const years = yearRangeLabel(filters);
  const versionLabel = facets.versions.find((option) => option.value === filters.version)?.label ?? filters.version;
  return [
    filters.family === null
      ? null
      : {
          id: "familia",
          label: `Família: ${familyLabel(filters.family)}`,
          without: { ...filters, family: null, version: null },
        },
    filters.version === null || versionLabel === null
      ? null
      : { id: "versao", label: `Versão: ${versionLabel}`, without: { ...filters, version: null } },
    years === null
      ? null
      : { id: "ano", label: `Ano: ${years}`, without: { ...filters, yearFrom: null, yearTo: null } },
    filters.maxKm === null
      ? null
      : { id: "km", label: `Até ${mileageLabel(filters.maxKm)}`, without: { ...filters, maxKm: null } },
    filters.origin === null
      ? null
      : { id: "origem", label: ORIGIN_LABELS[filters.origin], without: { ...filters, origin: null } },
  ].filter((chip) => chip !== null);
}

/** Mantém o modelo, o lote alvo e a condição da barra, limpando só os filtros da gaveta. */
function withoutDrawerFilters(filters: EvaluateFilters): EvaluateFilters {
  return {
    ...filters,
    family: null,
    version: null,
    yearFrom: null,
    yearTo: null,
    maxKm: null,
    origin: null,
  };
}

/** Mantém o modelo e o lote alvo, voltando todos os refinamentos ao padrão. */
function withoutRefinements(filters: EvaluateFilters): EvaluateFilters {
  return {
    ...DEFAULT_EVALUATE_FILTERS,
    vehicle: filters.vehicle,
    lot: filters.lot,
    excluded: filters.excluded,
  };
}

/**
 * Seletor do veículo do Avaliar (docs/PLANO-MERCADO.md §5.2): alinhado ao padrão do Panorama — linha fixa com busca de
 * modelo, condição, gaveta "Refinar recorte" (família, versão FIPE, ano, km e origem com rótulos visíveis) e chips
 * removíveis abaixo. "Limpar refinamentos" preserva o modelo escolhido; trocar o modelo recomeça o recorte.
 */
export function EvaluateFilterBar({ params, models, facets, lotTarget }: EvaluateFilterBarProps) {
  const router = useRouter();
  const conditionLabelId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const { isPending, startTransition } = useResearchTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parseEvaluateParams(params));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<EvaluateFilters>(filters);
  const [unlinkedLot, setUnlinkedLot] = useState<{ label: string; previous: EvaluateFilters } | null>(null);

  const drawerChips = facets === null || filters.vehicle === null ? [] : activeRefinements(filters, facets);
  const draftDrawerCount = facets === null || draft.vehicle === null ? 0 : activeRefinements(draft, facets).length;
  const draftChanged =
    draft.family !== filters.family ||
    draft.version !== filters.version ||
    draft.yearFrom !== filters.yearFrom ||
    draft.yearTo !== filters.yearTo ||
    draft.maxKm !== filters.maxKm ||
    draft.origin !== filters.origin;
  const conditionChanged = filters.condition !== DEFAULT_EVALUATE_FILTERS.condition;
  const totalRefinements = drawerChips.length + (conditionChanged ? 1 : 0);

  const resolvedEvaluateQuery = new URLSearchParams(params).toString();
  const resolvedSharedQuery = pickSharedQuery(params);
  useEffect(() => {
    rememberMarketContext({ shared: resolvedSharedQuery, evaluate: resolvedEvaluateQuery });
  }, [resolvedSharedQuery, resolvedEvaluateQuery]);

  function apply(next: EvaluateFilters, { focusStatus = false } = {}) {
    startTransition(() => {
      setOptimisticFilters(next);
      router.push(evaluateHref(next), { scroll: false });
    });
    if (focusStatus) statusRef.current?.focus();
  }

  return (
    <>
      <section
        aria-label="Veículo avaliado"
        className="grid gap-3 border-b border-border bg-surface pb-3 xl:sticky xl:top-12 xl:z-30 xl:py-2.5"
      >
        {lotTarget === null || filters.lot === null ? (
          unlinkedLot === null ? null : (
            <div
              role="status"
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-surface-subtle px-3 py-1.5 text-caption text-foreground-secondary"
            >
              <span>Comparação com {unlinkedLot.label} encerrada ao trocar de modelo.</span>
              <Button
                variant="link"
                size="sm"
                className="h-10 px-1 text-caption"
                onClick={() => {
                  const previous = unlinkedLot.previous;
                  setUnlinkedLot(null);
                  apply(previous, { focusStatus: true });
                }}
              >
                Desfazer
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar aviso de lote desvinculado"
                className="ml-auto"
                onClick={() => setUnlinkedLot(null)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-foreground">
            <span className="inline-flex items-center gap-2">
              <Target aria-hidden="true" className="size-4 shrink-0 text-muted" />
              <span>Comparando com o {lotTarget.label}</span>
            </span>
            {lotTarget.details ? (
              <span className="text-caption font-normal text-muted tabular-nums">{lotTarget.details}</span>
            ) : null}
            <Link
              href={`/lotes/${lotTarget.id}`}
              className="inline-flex min-h-10 items-center rounded-sm px-1 text-caption text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              Ver ficha do lote
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Deixar de comparar com o lote"
              onClick={() => {
                setUnlinkedLot(null);
                apply({ ...filters, lot: null }, { focusStatus: true });
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <ModelPicker
            value={filters.vehicle === null ? null : vehicleLabel(filters.vehicle)}
            options={models}
            placeholder="Busque um modelo: onix, cg 160, hilux…"
            clearLabel="Escolher outro modelo"
            onChange={(option) => {
              if (lotTarget !== null && filters.lot !== null) {
                setUnlinkedLot({ label: lotTarget.label, previous: filters });
              } else {
                setUnlinkedLot(null);
              }
              apply({
                ...DEFAULT_EVALUATE_FILTERS,
                vehicle: option === null ? null : { brand: option.brand, model: option.model },
                condition: filters.condition,
              });
            }}
            className="w-full md:w-auto md:min-w-60 md:flex-1"
          />

          {facets === null || filters.vehicle === null ? null : (
            <>
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
                <SelectTrigger
                  aria-labelledby={conditionLabelId}
                  className={cn("flex-1 md:w-52 md:flex-none", conditionChanged && researchActiveTriggerClass)}
                >
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

              <Dialog
                open={drawerOpen}
                onOpenChange={(open) => {
                  if (open) setDraft(filters);
                  setDrawerOpen(open);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    className={cn("flex-1 md:flex-none", drawerChips.length > 0 && researchActiveTriggerClass)}
                  >
                    <SlidersHorizontal aria-hidden="true" />
                    Mais filtros{drawerChips.length > 0 ? ` (${drawerChips.length})` : ""}
                  </Button>
                </DialogTrigger>
                <DrawerContent side="responsive">
                  <DialogHeader className="border-b border-border px-6 py-5">
                    <DialogTitle>Mais filtros</DialogTitle>
                    <DialogDescription className="text-caption text-muted">
                      Ajuste os filtros desejados e clique em Aplicar.
                    </DialogDescription>
                  </DialogHeader>
                  <DrawerBody className="gap-6">
                    {draftChanged ? (
                      <p role="status" className="rounded-md bg-surface-subtle px-3 py-2 text-caption text-muted">
                        As contagens refletem o recorte atual e serão atualizadas ao clicar em Aplicar.
                      </p>
                    ) : null}
                    <fieldset className="grid gap-4">
                      <legend className="mb-1 text-caption font-semibold text-muted">Veículo</legend>
                      {facets.families.length > 0 || draft.family !== null ? (
                        <DrawerSelect
                          label="Família"
                          hint="Agrupa carrocerias ou submodelos da mesma linha (ex.: Onix Plus)."
                          allLabel="Todas as famílias"
                          value={draft.family}
                          options={facets.families}
                          allowZero={draftChanged}
                          onChange={(family) => setDraft((current) => ({ ...current, family, version: null }))}
                        />
                      ) : null}

                      {facets.versions.length > 0 || draft.version !== null ? (
                        <DrawerSelect
                          label="Versão FIPE"
                          hint="Acabamento, motor e câmbio exatos da tabela FIPE."
                          allLabel="Todas as versões"
                          value={draft.version}
                          options={facets.versions}
                          allowZero={draftChanged}
                          onChange={(version) => setDraft((current) => ({ ...current, version }))}
                        />
                      ) : null}

                      <div className="grid grid-cols-2 gap-3">
                        <DrawerSelect
                          label="Ano-modelo de"
                          allLabel="Ano inicial"
                          value={draft.yearFrom === null ? null : String(draft.yearFrom)}
                          options={facets.years.map(({ year, n }) => ({ value: String(year), label: `De ${year}`, n }))}
                          allowZero={draftChanged}
                          onChange={(year) =>
                            setDraft((current) => ({
                              ...current,
                              ...normalizeYears(year === null ? null : Number(year), current.yearTo),
                            }))
                          }
                        />
                        <DrawerSelect
                          label="Ano-modelo até"
                          allLabel="Ano final"
                          value={draft.yearTo === null ? null : String(draft.yearTo)}
                          options={facets.years.map(({ year, n }) => ({
                            value: String(year),
                            label: `Até ${year}`,
                            n,
                          }))}
                          allowZero={draftChanged}
                          onChange={(year) =>
                            setDraft((current) => ({
                              ...current,
                              ...normalizeYears(current.yearFrom, year === null ? null : Number(year)),
                            }))
                          }
                        />
                      </div>

                      <DrawerSelect
                        label="Quilometragem máxima"
                        allLabel="Qualquer km"
                        value={draft.maxKm === null ? null : String(draft.maxKm)}
                        options={RESEARCH_MILEAGE_OPTIONS.map((km) => ({
                          value: String(km),
                          label: `Até ${mileageLabel(km)}`,
                        }))}
                        onChange={(km) =>
                          setDraft((current) => ({
                            ...current,
                            maxKm: RESEARCH_MILEAGE_OPTIONS.find((option) => String(option) === km) ?? null,
                          }))
                        }
                      />
                    </fieldset>

                    <fieldset className="grid gap-4 border-t border-border pt-5">
                      <legend className="mb-1 text-caption font-semibold text-muted">Leilão</legend>
                      <DrawerSelect
                        label="Origem"
                        allLabel="Qualquer origem"
                        value={draft.origin}
                        options={VEHICLE_ORIGINS.map((origin) => ({
                          value: origin,
                          label: ORIGIN_LABELS[origin],
                          n: facets.origins[origin],
                        }))}
                        allowZero={draftChanged}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            origin: VEHICLE_ORIGINS.find((key) => key === value) ?? null,
                          }))
                        }
                      />
                    </fieldset>
                  </DrawerBody>
                  <DrawerFooter className="flex-wrap">
                    <Button
                      variant="ghost"
                      className="md:mr-auto"
                      onClick={() => setDraft((current) => withoutDrawerFilters(current))}
                      disabled={draftDrawerCount === 0}
                    >
                      Limpar filtros
                    </Button>
                    <DialogClose asChild>
                      <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button
                      onClick={() => {
                        setDrawerOpen(false);
                        apply(draft, { focusStatus: true });
                      }}
                    >
                      Aplicar
                    </Button>
                  </DrawerFooter>
                </DrawerContent>
              </Dialog>

              <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 xl:ml-2 xl:w-auto xl:shrink-0">
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
                  ) : filters.excluded.length > 0 ? (
                    `${salesLabel(facets.total)} na conta (${filters.excluded.length} ${filters.excluded.length === 1 ? "excluída" : "excluídas"})`
                  ) : (
                    `${salesLabel(facets.total)} no recorte`
                  )}
                </p>
                {totalRefinements > 0 ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-10 px-1"
                    onClick={() => apply(withoutRefinements(filters), { focusStatus: true })}
                  >
                    Limpar filtros
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      {drawerChips.length > 0 ? (
        <div className="-mt-3">
          <ActiveFilterChips
            chips={drawerChips}
            onRemove={(id) => {
              const chip = drawerChips.find((item) => item.id === id);
              if (chip) apply(chip.without, { focusStatus: true });
            }}
          />
        </div>
      ) : null}
    </>
  );
}

/** Seletor de gaveta com rótulo visível, ajuda opcional e contagem por opção. */
function DrawerSelect({
  label,
  hint,
  allLabel,
  value,
  options,
  allowZero = false,
  onChange,
}: {
  label: string;
  hint?: string;
  allLabel: string;
  value: string | null;
  options: readonly { value: string; label: string; n?: number }[];
  allowZero?: boolean;
  onChange: (value: string | null) => void;
}) {
  const labelId = useId();
  const chosen = options.find((option) => option.value === value);
  return (
    <DrawerField labelId={labelId} label={label}>
      {hint ? <p className="text-caption text-muted">{hint}</p> : null}
      <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{chosen?.label ?? value ?? allLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={!allowZero && option.n === 0 && option.value !== value}
            >
              {option.n === undefined ? option.label : <OptionWithCount label={option.label} count={option.n} />}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DrawerField>
  );
}
