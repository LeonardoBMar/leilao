"use client";

import { ChevronDown, LoaderCircle, SlidersHorizontal, Target } from "lucide-react";
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
  RadioGroup,
  RadioItem,
  RemovableChip,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { SearchBox } from "@/features/listings/components/filters/search-box";
import { withQuery } from "@/features/listings/search";
import { cn } from "@/lib/utils";

import {
  activeLotFilters,
  clearedLotFilters,
  LOT_POSITION_HINTS,
  LOT_POSITION_LABELS,
  LOT_SORT_LABELS,
} from "../filter-labels";
import { LOT_POSITION_KEYS, LOT_SORT_KEYS, type LotFilters as Filters, lotParams, parseLotParams } from "../schemas";

type LotFiltersProps = {
  /** Filtros da URL na forma canônica (`lotParams`), já aplicados ao resultado. */
  params: Readonly<Record<string, string>>;
  /** Rota da listagem: `/minhas-analises` ou `/minhas-analises/leiloes/<id>`. */
  basePath: string;
  /** Parâmetros da tela que os filtros preservam (ex.: `vista=leilao` em "Minhas análises"). */
  fixedParams?: Readonly<Record<string, string>>;
  /** Total do resultado e o que se conta ("lotes" ou "leilões"). */
  total: number;
  unit: { one: string; many: string };
  /** Num leilão só: sem o filtro de leilão próximo/realizado, e a ordem padrão vira "Número do lote". */
  inAuction?: boolean;
  /** Mostra "Ordenar" (a vista por leilão tem ordem fixa: a data do leilão). */
  sortable?: boolean;
};

/** Filtros que ficam na barra (e não contam em "Mais filtros"). */
const BAR_FILTERS = ["busca", "posicao", "leilao"];

/**
 * Filtros de Minhas análises (docs/PLANO-FILTROS.md §5), no padrão da barra de Leilões: aplicam na hora, chips dos
 * filtros ativos, total e ordem.
 */
export function LotFilters({
  params,
  basePath,
  fixedParams = {},
  total,
  unit,
  inAuction = false,
  sortable = true,
}: LotFiltersProps) {
  const router = useRouter();
  const sortLabelId = useId();
  // Chip, atalho e "Limpar tudo" somem ao aplicar: o foco vai para o total, que anuncia o resultado.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const applyAndFocusStatus = (next: Parameters<typeof apply>[0]) => {
    apply(next);
    statusRef.current?.focus();
  };
  const [isPending, startTransition] = useTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parseLotParams(params));
  const chips = activeLotFilters(filters);
  const moreCount = chips.filter((chip) => !BAR_FILTERS.includes(chip.id)).length;
  const mobileCount = chips.filter((chip) => chip.id !== "busca").length;

  function apply(next: Filters) {
    const target = { ...next, page: 1 };
    startTransition(() => {
      setOptimisticFilters(target);
      router.push(withQuery(basePath, { ...lotParams(target), ...fixedParams }), { scroll: false });
    });
  }

  const position = (
    <RadioGroup
      aria-label="Lance × limite"
      value={filters.position ?? "todos"}
      onValueChange={(value) => apply({ ...filters, position: LOT_POSITION_KEYS.find((key) => key === value) })}
      className="gap-0"
    >
      <RadioItem value="todos" label="Todos" />
      {LOT_POSITION_KEYS.map((key) => (
        <RadioItem key={key} value={key} label={LOT_POSITION_LABELS[key]} description={LOT_POSITION_HINTS[key]} />
      ))}
    </RadioGroup>
  );
  const timing = (hideLabel: boolean) =>
    inAuction ? null : (
      <SegmentedControl
        label="Leilão"
        hideLabel={hideLabel}
        value={filters.timing ?? "todos"}
        options={[
          { value: "todos", label: "Todos" },
          { value: "proximos", label: "Próximos" },
          { value: "realizados", label: "Realizados" },
        ]}
        onValueChange={(value) => apply({ ...filters, timing: value === "todos" ? undefined : value })}
      />
    );
  const more = (
    <>
      <SegmentedControl
        label="Análise"
        value={filters.analysis ?? "todas"}
        options={[
          { value: "todas", label: "Todas" },
          { value: "com", label: "Com fixada" },
          { value: "sem", label: "Sem fixada" },
        ]}
        onValueChange={(value) => apply({ ...filters, analysis: value === "todas" ? undefined : value })}
      />
      <SegmentedControl
        label="Resultado"
        value={filters.result ?? "todos"}
        options={[
          { value: "todos", label: "Todos" },
          { value: "com", label: "Com resultado" },
          { value: "sem", label: "Sem resultado" },
        ]}
        onValueChange={(value) => apply({ ...filters, result: value === "todos" ? undefined : value })}
      />
      <div className="grid">
        <Checkbox
          label="Só acompanhados"
          checked={filters.followedOnly}
          onCheckedChange={(checked) => apply({ ...filters, followedOnly: checked === true })}
        />
        <Checkbox
          label="Só arquivados"
          description="Lotes e leilões arquivados ficam fora da lista até você pedir."
          checked={filters.archived}
          onCheckedChange={(checked) => apply({ ...filters, archived: checked === true })}
        />
      </div>
    </>
  );
  const countText = `${total.toLocaleString("pt-BR")} ${total === 1 ? unit.one : unit.many}`;
  const drawerFooter = (
    <DrawerFooter>
      <Button variant="secondary" onClick={() => apply(clearedLotFilters(filters))} disabled={chips.length === 0}>
        Limpar tudo
      </Button>
      <DialogClose asChild>
        <Button>{isPending ? "Atualizando…" : `Ver ${countText}`}</Button>
      </DialogClose>
    </DrawerFooter>
  );

  return (
    <section aria-label="Filtros" className="grid gap-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={filters.search ?? null}
          suggestions={[]}
          onSearch={(search) => apply({ ...filters, search: search ?? undefined })}
          label="Buscar por lote, marca ou modelo"
          placeholder="Buscar por lote, marca ou modelo"
          className="w-full md:w-auto md:min-w-64 md:flex-1"
        />
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" className={cn(filters.position && activeTriggerClass)}>
                <Target aria-hidden="true" />
                {filters.position ? (
                  <>
                    <span className="sr-only">Lance × limite: </span>
                    {LOT_POSITION_LABELS[filters.position]}
                  </>
                ) : (
                  "Lance × limite"
                )}
                <ChevronDown aria-hidden="true" className="text-muted" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96">{position}</PopoverContent>
          </Popover>
          {inAuction ? null : <div className="w-72">{timing(true)}</div>}
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
              <DrawerBody>{more}</DrawerBody>
              {drawerFooter}
            </DrawerContent>
          </Dialog>
        </div>
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
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-label text-foreground">Lance × limite</legend>
                {position}
              </fieldset>
              {timing(false)}
              {more}
            </DrawerBody>
            {drawerFooter}
          </DrawerContent>
        </Dialog>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <ul aria-label="Filtros ativos" className="contents">
            {chips.map((chip) => (
              <li key={chip.id} className="flex max-w-full">
                <RemovableChip
                  removeLabel={`Remover filtro ${chip.label}`}
                  onRemove={() => applyAndFocusStatus(chip.without)}
                >
                  {chip.label}
                </RemovableChip>
              </li>
            ))}
          </ul>
          {chips.length > 1 ? (
            <Button
              variant="link"
              size="sm"
              className="h-10 px-1"
              onClick={() => applyAndFocusStatus(clearedLotFilters(filters))}
            >
              Limpar tudo
            </Button>
          ) : null}
        </div>
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
            countText
          )}
        </p>
        {sortable ? (
          <div className="flex items-center gap-2">
            <span id={sortLabelId} className="text-label text-foreground-secondary">
              Ordenar
            </span>
            <Select
              value={filters.sort}
              onValueChange={(value) => {
                const sort = LOT_SORT_KEYS.find((key) => key === value);
                if (sort) apply({ ...filters, sort });
              }}
            >
              <SelectTrigger aria-labelledby={sortLabelId} className="w-60">
                <SelectValue>
                  {filters.sort === "leilao" && inAuction ? "Número do lote" : LOT_SORT_LABELS[filters.sort]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LOT_SORT_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key === "leilao" && inAuction ? "Número do lote" : LOT_SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const activeTriggerClass = "border-accent bg-accent-subtle text-accent-hover";
