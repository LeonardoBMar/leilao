"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { LayoutGroup, motion } from "motion/react";
import { useId } from "react";

import { MOTION_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: React.ReactNode };

type SegmentedControlProps<T extends string> = {
  /** Rótulo do grupo; com `hideLabel`, só para leitores de tela. */
  label: string;
  hideLabel?: boolean;
  value: T;
  options: readonly SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  /** Envia o valor num formulário (o Radix cria o input escondido). */
  name?: string;
  className?: string;
};

/**
 * Escolha única entre poucas opções curtas, todas visíveis (DESIGN.md §5.3): grupo de rádio do Radix, com setas entre
 * as opções. A marcada é a cápsula branca da navegação, em negrito. Texto longo quebra dentro do próprio segmento.
 */
function SegmentedControl<T extends string>({
  label,
  hideLabel = false,
  value,
  options,
  onValueChange,
  name,
  className,
}: SegmentedControlProps<T>) {
  const labelId = useId();
  const groupId = useId();
  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <span id={labelId} className={hideLabel ? "sr-only" : "text-label text-foreground"}>
        {label}
      </span>
      <LayoutGroup id={groupId}>
        <RadioGroupPrimitive.Root
          aria-labelledby={labelId}
          name={name}
          value={value}
          onValueChange={(next) => {
            const option = options.find((item) => item.value === next);
            if (option) onValueChange(option.value);
          }}
          orientation="horizontal"
          className="flex w-full gap-0.5 rounded-md bg-surface-subtle p-0.5"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <RadioGroupPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-sm px-2 py-1 text-center text-caption leading-tight font-medium text-foreground-secondary transition-colors duration-120 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:font-semibold data-[state=checked]:text-foreground"
              >
                {isSelected ? (
                  <motion.span
                    aria-hidden="true"
                    layoutId="segmented-indicator"
                    transition={MOTION_SPRING}
                    className="pointer-events-none absolute inset-0 rounded-sm bg-surface shadow-sm"
                  />
                ) : null}
                <span className="relative z-10">{option.label}</span>
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
      </LayoutGroup>
    </div>
  );
}

export { SegmentedControl };
