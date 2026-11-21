"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

import { Field, FieldDescription, FieldError, FieldLabel, RequiredMark } from "./field";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({ className, children, ...props }: SelectPrimitive.SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-control-border bg-surface px-3 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-subtle data-[placeholder]:text-placeholder sm:h-9 sm:text-body [&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 4,
  ...props
}: SelectPrimitive.SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          "relative z-50 max-h-80 origin-[var(--radix-select-content-transform-origin)] overflow-hidden overscroll-contain rounded-lg border border-border bg-surface-elevated text-foreground shadow-md",
          position === "popper" &&
            "max-h-[min(20rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)]",
          className,
        )}
        position={position}
        sideOffset={sideOffset}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-10 items-center justify-center text-muted">
          <ChevronUp aria-hidden="true" className="size-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-10 items-center justify-center text-muted">
          <ChevronDown aria-hidden="true" className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.SelectLabelProps) {
  return (
    <SelectPrimitive.Label className={cn("px-2 py-1.5 text-caption font-semibold text-muted", className)} {...props} />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex min-h-10 w-full cursor-default items-center rounded-md py-2 pr-8 pl-2 text-body outline-none select-none focus:bg-foreground/5 focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:text-muted-subtle",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check aria-hidden="true" className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.SelectSeparatorProps) {
  return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

type SelectFieldOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SelectFieldProps = Omit<SelectPrimitive.SelectProps, "children"> & {
  id?: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  options: SelectFieldOption[];
  className?: string;
};

function SelectField({
  id,
  label,
  placeholder = "Selecione uma opção",
  helperText,
  error,
  required,
  options,
  className,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;

  return (
    <Field className={className}>
      {label ? (
        <FieldLabel htmlFor={selectId}>
          {label}
          {required ? <RequiredMark /> : null}
        </FieldLabel>
      ) : null}
      <Select {...props} required={required}>
        <SelectTrigger
          id={selectId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          className={cn(error && "border-error focus:border-error focus:ring-error/20")}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <FieldError id={messageId}>{error}</FieldError>
      ) : helperText ? (
        <FieldDescription id={messageId}>{helperText}</FieldDescription>
      ) : null}
    </Field>
  );
}

export {
  Select,
  SelectContent,
  SelectField,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
