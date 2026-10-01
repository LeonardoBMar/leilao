"use client";

import { LoaderCircle } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

import { Field, FieldDescription, FieldError, FieldLabel, RequiredMark } from "./field";

export type InputProps = React.ComponentProps<"input"> & {
  label?: string;
  helperText?: string;
  error?: string;
  loading?: boolean;
  containerClassName?: string;
};

function Input({
  id,
  label,
  helperText,
  error,
  loading = false,
  required,
  disabled,
  className,
  containerClassName,
  "aria-describedby": ariaDescribedBy,
  ...props
}: InputProps) {
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
        <input
          id={inputId}
          required={required}
          disabled={disabled || loading}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy || undefined}
          aria-busy={loading || undefined}
          className={cn(
            "h-10 w-full rounded-md border border-control-border bg-surface px-3 text-body text-foreground transition-[border-color,box-shadow] duration-120 outline-none placeholder:text-placeholder read-only:bg-surface-subtle read-only:text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-subtle",
            error && "border-error focus:border-error focus:ring-error/20",
            loading && "pr-10",
            className,
          )}
          {...props}
        />
        {loading ? (
          <LoaderCircle
            aria-hidden="true"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted"
          />
        ) : null}
      </div>
      {error ? (
        <FieldError id={messageId}>{error}</FieldError>
      ) : helperText ? (
        <FieldDescription id={messageId}>{helperText}</FieldDescription>
      ) : null}
    </Field>
  );
}

export { Input };
