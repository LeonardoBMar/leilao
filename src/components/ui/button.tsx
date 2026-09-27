"use client";

import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Children, cloneElement, type ReactElement, type ReactNode, type SyntheticEvent } from "react";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button-variants";

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    loadingLabel?: string;
  };

function blockActivation(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  loadingLabel,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const reservesLoading = loading !== undefined || loadingLabel !== undefined;

  function content(label: ReactNode) {
    if (!reservesLoading) return label;
    // Both states occupy the same grid cell, reserving the larger width.
    return (
      <span className="inline-grid place-items-center">
        <span
          className={cn(
            "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
            loading && "invisible",
          )}
          aria-hidden={loading || undefined}
        >
          {label}
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
            !loading && "invisible",
          )}
          aria-hidden={!loading || undefined}
        >
          <LoaderCircle aria-hidden="true" className={cn(loading && "animate-spin")} />
          {size !== "icon" ? <span className="[&>svg]:hidden">{loadingLabel ?? label}</span> : null}
        </span>
      </span>
    );
  }

  const sharedProps = {
    ...props,
    className: cn(buttonVariants({ variant, size }), className),
    "aria-busy": loading || undefined,
    "data-loading": loading || undefined,
    "data-disabled": Boolean(disabled && !loading) || undefined,
  };

  if (asChild) {
    const child = Children.only(children) as ReactElement<React.ComponentProps<"a">>;
    const blockedProps = isDisabled
      ? {
          "aria-disabled": true as const,
          tabIndex: -1,
          onClick: blockActivation,
          onClickCapture: blockActivation,
          onAuxClick: blockActivation,
          onKeyDownCapture: (event: React.KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") blockActivation(event);
          },
          ...(child.type === "a" ? { href: undefined, role: "link" } : {}),
        }
      : {};

    return (
      <Slot {...sharedProps} {...blockedProps}>
        {cloneElement(child, blockedProps, content(child.props.children))}
      </Slot>
    );
  }

  return (
    <button {...sharedProps} disabled={isDisabled} type={type ?? "button"}>
      {content(children)}
    </button>
  );
}

export { Button };
