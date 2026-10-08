"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToggleChipProps = Omit<React.ComponentProps<"button">, "onChange" | "type"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  icon?: React.ReactNode;
  /** Quantos itens a escolha traria (faceta). Zero esmaece o texto, sem desabilitar o chip. */
  count?: number;
};

/**
 * Chip de escolha múltipla (`aria-pressed`). Marcado usa a cor de seleção (`accent`) e troca o ícone pela marca de
 * seleção: a cor nunca é o único sinal.
 */
function ToggleChip({ pressed, onPressedChange, icon, count, className, children, ...props }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-label transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 [&_svg]:size-4 [&_svg]:shrink-0",
        pressed
          ? "border-accent bg-accent-subtle text-accent-hover"
          : "border-control-border bg-surface text-foreground hover:bg-surface-subtle",
        !pressed && count === 0 && "text-muted",
        className,
      )}
      {...props}
    >
      {pressed ? <Check aria-hidden="true" /> : icon}
      <span>{children}</span>
      {count === undefined ? null : (
        <span className={cn("text-caption tabular-nums", pressed ? "text-accent-hover" : "text-muted")}>{count}</span>
      )}
    </button>
  );
}

type RemovableChipProps = {
  children: React.ReactNode;
  onRemove: () => void;
  /** Texto do botão de remover para leitores de tela (ex.: "Remover filtro Até R$ 30 mil"). */
  removeLabel: string;
  disabled?: boolean;
  className?: string;
};

/** Filtro ativo: o texto e o "×" que o tira. O "×" tem área de toque de 40 px. */
function RemovableChip({ children, onRemove, removeLabel, disabled, className }: RemovableChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 max-w-full items-center gap-0.5 rounded-full bg-primary-subtle py-0.5 pr-0.5 pl-3 text-caption font-medium text-foreground",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={removeLabel}
        className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-120 outline-none before:absolute before:-inset-1.5 hover:bg-primary-subtle-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </span>
  );
}

export { RemovableChip, ToggleChip };
