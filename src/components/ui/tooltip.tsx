"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({ className, sideOffset = 6, ...props }: TooltipPrimitive.TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-64 origin-[var(--radix-tooltip-content-transform-origin)] rounded-md border border-transparent bg-foreground px-2.5 py-1.5 text-caption text-white shadow-md transition-[opacity,transform] duration-150 ease-[var(--ease-out)] data-[state=instant-open]:transition-none starting:scale-[0.97] starting:opacity-0 motion-reduce:transition-none",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
