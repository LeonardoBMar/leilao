"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

import { Field, FieldDescription, FieldError, FieldLabel, RequiredMark } from "./field";

export type TextareaProps = React.ComponentProps<"textarea"> & {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
};

function Textarea({
  id,
  label,
  helperText,
  error,
  required,
  className,
  containerClassName,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-message`;
  const describedBy = [ariaDescribedBy, error || helperText ? messageId : undefined].filter(Boolean).join(" ");

  return (
    <Field className={containerClassName}>
      {label ? (
        <FieldLabel htmlFor={textareaId}>
          {label}
          {required ? <RequiredMark /> : null}
        </FieldLabel>
      ) : null}
      <textarea
        id={textareaId}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "min-h-24 w-full resize-y rounded-md border border-control-border bg-surface px-3 py-2 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)] outline-none placeholder:text-placeholder read-only:bg-surface-subtle focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-subtle sm:text-body",
          error && "border-error focus:border-error focus:ring-error/20",
          className,
        )}
        {...props}
      />
      {error ? (
        <FieldError id={messageId}>{error}</FieldError>
      ) : helperText ? (
        <FieldDescription id={messageId}>{helperText}</FieldDescription>
      ) : null}
    </Field>
  );
}

export { Textarea };
