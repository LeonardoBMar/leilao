"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

import { Field, FieldDescription, FieldError, FieldLabel, RequiredMark } from "./field";

export type CurrencyInputProps = Omit<React.ComponentProps<"input">, "type" | "inputMode"> & {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
  /** Em grades financeiras o valor fica à direita (DESIGN.md §5.2). */
  align?: "left" | "right";
};

/**
 * Valor em reais no formato brasileiro ("1.234,56"). Não reformata enquanto o usuário digita, para não mover o
 * cursor; a conversão para centavos acontece no schema (`brlAmount`).
 */
function CurrencyInput({
  id,
  label,
  helperText,
  error,
  required,
  className,
  containerClassName,
  align = "left",
  "aria-describedby": ariaDescribedBy,
  ...props
}: CurrencyInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const describedBy = [ariaDescribedBy, error || helperText ? messageId : undefined].filter(Boolean).join(" ");

  return (
    <Field className={containerClassName}>
      {label ? (
        <FieldLabel htmlFor={inputId}>
          {label}
          {required ? <RequiredMark /> : null}
        </FieldLabel>
      ) : null}
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-muted"
        >
          R$
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-10 w-full rounded-md border border-control-border bg-surface pr-3 pl-10 text-body text-foreground tabular-nums transition-[border-color,box-shadow] duration-120 outline-none placeholder:text-placeholder read-only:bg-surface-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-subtle",
            align === "right" && "text-right",
            error && "border-error focus:border-error focus:ring-error/20",
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <FieldError id={messageId}>{error}</FieldError>
      ) : helperText ? (
        <FieldDescription id={messageId}>{helperText}</FieldDescription>
      ) : null}
    </Field>
  );
}

export { CurrencyInput };
