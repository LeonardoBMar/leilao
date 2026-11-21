"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverClose = PopoverPrimitive.Close;

/** Painel flutuante não modal (DESIGN.md §5.9): fecha com Escape ou clique fora e devolve o foco ao gatilho. */
function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: PopoverPrimitive.PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          "z-50 grid max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-2rem)] origin-[var(--radix-popover-content-transform-origin)] gap-4 overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface-elevated p-4 text-foreground shadow-md outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverClose, PopoverContent, PopoverTrigger };
