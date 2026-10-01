import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = React.ComponentProps<"div"> & {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** `inline`: faixa compacta dentro de uma seção (texto à esquerda, ação à direita, sem ícone). */
  variant?: "default" | "inline";
};

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
  ...props
}: EmptyStateProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-border px-5 py-4.5 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
        {...props}
      >
        <div className="grid gap-0.5">
          <h3 className="text-body font-medium text-foreground">{title}</h3>
          {description ? <p className="text-label font-normal text-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface px-5 py-10 text-center",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-subtle text-muted">
          <Icon aria-hidden="true" className="size-6" />
        </span>
      ) : null}
      <h3 className="text-heading-3 text-foreground">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-body text-foreground-secondary">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
