"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

import { FieldDescription, FieldError } from "./field";

export type CheckboxProps = CheckboxPrimitive.CheckboxProps & {
  label?: React.ReactNode;
  description?: string;
  error?: string;
  containerClassName?: string;
};

function Checkbox({ id, label, description, error, containerClassName, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const messageId = `${checkboxId}-message`;

  return (
    <div className={cn("grid gap-1.5", containerClassName)}>
      <div className="flex items-start gap-2">
        <CheckboxPrimitive.Root
          id={checkboxId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error || description ? messageId : undefined}
          className={cn(
            "group flex size-10 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-60",
            className,
          )}
          {...props}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-sm border border-control-border bg-surface text-white transition-colors duration-120 group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary group-data-[state=indeterminate]:border-primary group-data-[state=indeterminate]:bg-primary",
              error &&
                "border-error group-data-[state=checked]:border-error group-data-[state=checked]:bg-error group-data-[state=indeterminate]:border-error group-data-[state=indeterminate]:bg-error",
            )}
          >
            <CheckboxPrimitive.Indicator>
              <Check aria-hidden="true" className="size-4 group-data-[state=indeterminate]:hidden" strokeWidth={3} />
              <Minus
                aria-hidden="true"
                className="hidden size-4 group-data-[state=indeterminate]:block"
                strokeWidth={3}
              />
            </CheckboxPrimitive.Indicator>
          </span>
        </CheckboxPrimitive.Root>
        {label ? (
          <label
            className="flex min-h-10 cursor-pointer items-center py-2 text-label text-foreground"
            htmlFor={checkboxId}
          >
            {label}
          </label>
        ) : null}
      </div>
      {error ? (
        <FieldError id={messageId} className="ml-12">
          {error}
        </FieldError>
      ) : description ? (
        <FieldDescription id={messageId} className="ml-12">
          {description}
        </FieldDescription>
      ) : null}
    </div>
  );
}

export { Checkbox };
