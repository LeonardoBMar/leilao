import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 w-fit items-center gap-1 rounded-sm border px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-subtle text-foreground-secondary",
        primary: "border-info-border bg-info-subtle text-primary-active",
        success: "border-success-border bg-success-subtle text-success",
        warning: "border-warning-border bg-warning-subtle text-warning",
        destructive: "border-error-border bg-error-subtle text-error",
        outline: "border-border-strong bg-transparent text-foreground-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
