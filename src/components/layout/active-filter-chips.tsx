"use client";

import { Plus } from "lucide-react";
import { AnimatePresence, LayoutGroup, m } from "motion/react";

import { Button, RemovableChip } from "@/components/ui";
import { MOTION_EXIT_TRANSITION, MOTION_LAYOUT_TRANSITION } from "@/lib/motion";

export type ActiveFilterChip = {
  id: string;
  label: string;
};

export type FilterShortcut = {
  id: string;
  label: string;
};

type ActiveFilterChipsProps = {
  chips: readonly ActiveFilterChip[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  clearThreshold?: number;
  shortcuts?: readonly FilterShortcut[];
  onApplyShortcut?: (id: string) => void;
};

/**
 * Faixa compartilhada de chips dos filtros ativos, com botão opcional "Limpar tudo" e atalhos rápidos.
 */
export function ActiveFilterChips({
  chips,
  onRemove,
  onClearAll,
  clearThreshold = 2,
  shortcuts = [],
  onApplyShortcut,
}: ActiveFilterChipsProps) {
  if (chips.length === 0 && shortcuts.length === 0) return null;

  return (
    <LayoutGroup>
      <div className="relative flex flex-wrap items-center gap-2">
        {chips.length > 0 ? (
          <ul aria-label="Filtros ativos" className="contents">
            <AnimatePresence mode="popLayout" initial={false}>
              {chips.map((chip) => (
                <m.li
                  key={chip.id}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94, transition: MOTION_EXIT_TRANSITION }}
                  transition={MOTION_LAYOUT_TRANSITION}
                  className="flex max-w-full"
                >
                  <RemovableChip removeLabel={`Remover filtro ${chip.label}`} onRemove={() => onRemove(chip.id)}>
                    {chip.label}
                  </RemovableChip>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : null}
        {onClearAll ? (
          <AnimatePresence mode="popLayout" initial={false}>
            {chips.length >= clearThreshold ? (
              <m.div
                key="clear-all"
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: MOTION_EXIT_TRANSITION }}
                transition={MOTION_LAYOUT_TRANSITION}
              >
                <Button variant="link" size="sm" className="h-10 px-1" onClick={onClearAll}>
                  Limpar tudo
                </Button>
              </m.div>
            ) : null}
          </AnimatePresence>
        ) : null}
        {shortcuts.length > 0 && onApplyShortcut ? (
          <ul aria-label="Atalhos de filtro" className="contents">
            <AnimatePresence mode="popLayout" initial={false}>
              {shortcuts.map((shortcut) => (
                <m.li
                  key={shortcut.id}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94, transition: MOTION_EXIT_TRANSITION }}
                  transition={MOTION_LAYOUT_TRANSITION}
                  className="flex"
                >
                  <button
                    type="button"
                    onClick={() => onApplyShortcut(shortcut.id)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-full border border-dashed border-control-border px-3 text-caption font-medium text-foreground-secondary transition-colors duration-120 outline-none hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    {shortcut.label}
                  </button>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : null}
      </div>
    </LayoutGroup>
  );
}
