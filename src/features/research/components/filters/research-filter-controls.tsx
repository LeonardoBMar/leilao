"use client";

import { LoaderCircle, SlidersHorizontal } from "lucide-react";
import { type ReactNode, type RefObject, useId } from "react";

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
import {
  RESEARCH_CATEGORIES,
  RESEARCH_CONDITIONS,
  type ResearchCategory,
  type ResearchCondition,
} from "@/domain/research/filters";
import { cn } from "@/lib/utils";

import { CATEGORY_LABELS, CONDITION_LABELS } from "../../labels";
import { DrawerField, OptionWithCount, researchActiveTriggerClass } from "./research-filter-selects";

/** Valor do item "todos" do seletor genérico da gaveta: o `Select` não aceita valor vazio. */
const ALL = "todos";

/** Seletor de condição na barra fixa do Mercado (Avaliar e Panorama). */
export function ConditionSelect({
  value,
  counts,
  changed,
  triggerClassName,
  onChange,
}: {
  value: ResearchCondition;
  counts: Readonly<Record<ResearchCondition, number>>;
  changed: boolean;
  triggerClassName: string;
  onChange: (condition: ResearchCondition) => void;
}) {
  const labelId = useId();
  return (
    <>
      <span id={labelId} className="sr-only">
        Condição
      </span>
      <Select
        value={value}
        onValueChange={(next) => {
          const condition = RESEARCH_CONDITIONS.find((key) => key === next);
          if (condition) onChange(condition);
        }}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          className={cn(triggerClassName, changed && researchActiveTriggerClass)}
        >
          <SelectValue>
            <span className="text-muted">Condição: </span>
            {CONDITION_LABELS[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {RESEARCH_CONDITIONS.map((condition) => (
            <SelectItem key={condition} value={condition} disabled={counts[condition] === 0 && condition !== value}>
              <OptionWithCount label={CONDITION_LABELS[condition]} count={counts[condition]} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/** Seletor de categoria na barra fixa do Panorama. */
export function CategorySelect({
  value,
  counts,
  changed,
  onChange,
}: {
  value: ResearchCategory;
  counts: Readonly<Record<ResearchCategory, number>>;
  changed: boolean;
  onChange: (category: ResearchCategory) => void;
}) {
  const labelId = useId();
  return (
    <>
      <span id={labelId} className="sr-only">
        Categoria
      </span>
      <Select
        value={value}
        onValueChange={(next) => {
          const category = RESEARCH_CATEGORIES.find((key) => key === next);
          if (category) onChange(category);
        }}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          className={cn("flex-1 md:w-44 md:flex-none", changed && researchActiveTriggerClass)}
        >
          <SelectValue>
            <span className="text-muted">Categoria: </span>
            {CATEGORY_LABELS[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {RESEARCH_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category} disabled={counts[category] === 0 && category !== value}>
              <OptionWithCount label={CATEGORY_LABELS[category]} count={counts[category]} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/** Seletor de gaveta com rótulo visível, ajuda opcional e contagem por opção. */
export function DrawerSelect({
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

/** Gaveta "Mais filtros" compartilhada entre Avaliar e Panorama. */
export function MoreFiltersDrawer({
  open,
  onOpenChange,
  activeCount,
  draftCount,
  onClearDraft,
  onApply,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  draftCount: number;
  onClearDraft: () => void;
  onApply: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className={cn("flex-1 md:flex-none", activeCount > 0 && researchActiveTriggerClass)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Mais filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </DialogTrigger>
      <DrawerContent side="responsive">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>Mais filtros</DialogTitle>
          <DialogDescription className="text-caption text-muted">
            Ajuste os filtros desejados e clique em Aplicar.
          </DialogDescription>
        </DialogHeader>
        <DrawerBody className="gap-6">{children}</DrawerBody>
        <DrawerFooter className="flex-wrap">
          <Button variant="ghost" className="md:mr-auto" onClick={onClearDraft} disabled={draftCount === 0}>
            Limpar filtros
          </Button>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={onApply}>Aplicar</Button>
        </DrawerFooter>
      </DrawerContent>
    </Dialog>
  );
}

/** Total de vendas com indicador de atualização e botão "Limpar filtros". */
export function FilterStatusSummary({
  statusRef,
  isPending,
  showClear,
  onClear,
  className,
  children,
}: {
  statusRef: RefObject<HTMLParagraphElement | null>;
  isPending: boolean;
  showClear: boolean;
  onClear: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
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
          children
        )}
      </p>
      {showClear ? (
        <Button variant="link" size="sm" className="h-10 px-1" onClick={onClear}>
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
