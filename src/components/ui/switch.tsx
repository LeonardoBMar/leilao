"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId } from "react";

import { cn } from "@/lib/utils";

export type SwitchProps = SwitchPrimitive.SwitchProps & {
  label?: React.ReactNode;
  description?: string;
  containerClassName?: string;
};

function Switch({ id, label, description, containerClassName, className, ...props }: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;

  return (
    <div className={cn("flex min-h-10 items-start justify-between gap-4", containerClassName)}>
      {label ? (
        <label className="grid min-h-10 cursor-pointer content-center gap-1 py-2" htmlFor={switchId}>
          <span className="text-label text-foreground">{label}</span>
          {description ? <span className="text-caption text-muted">{description}</span> : null}
        </label>
      ) : null}
      <SwitchPrimitive.Root
        id={switchId}
        className={cn(
          "group inline-flex h-10 w-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-60",
          className,
        )}
        {...props}
      >
        <span className="inline-flex h-6 w-11 items-center rounded-full bg-control-border p-0.5 transition-colors duration-180 group-data-[state=checked]:bg-primary">
          <SwitchPrimitive.Thumb className="block size-5 rounded-full bg-white shadow-sm transition-transform duration-180 data-[state=checked]:translate-x-5" />
        </span>
      </SwitchPrimitive.Root>
    </div>
  );
}

export { Switch };
