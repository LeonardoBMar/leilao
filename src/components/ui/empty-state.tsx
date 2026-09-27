import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = React.ComponentProps<"div"> & {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
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
