"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { useId } from "react";

import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.RadioGroupProps) {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} />;
}

type RadioItemProps = RadioGroupPrimitive.RadioGroupItemProps & {
  label: React.ReactNode;
  description?: string;
};

function RadioItem({ id, label, description, className, ...props }: RadioItemProps) {
  const generatedId = useId();
  const radioId = id ?? generatedId;

  return (
    <div className="flex items-start gap-2">
      <RadioGroupPrimitive.Item
        id={radioId}
        className={cn(
          "group flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-60",
          className,
        )}
        {...props}
      >
        <span className="flex size-5 items-center justify-center rounded-full border border-control-border bg-surface transition-colors duration-120 group-data-[state=checked]:border-primary">
          <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-primary" />
        </span>
      </RadioGroupPrimitive.Item>
      <label className="grid min-h-10 cursor-pointer content-center gap-1 py-2" htmlFor={radioId}>
        <span className="text-label text-foreground">{label}</span>
        {description ? <span className="text-caption text-muted">{description}</span> : null}
      </label>
    </div>
  );
}

export { RadioGroup, RadioItem };
