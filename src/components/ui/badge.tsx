import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-5.5 w-fit items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-caption font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary-subtle text-foreground-secondary",
        primary: "bg-info-subtle text-info",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        destructive: "bg-error-subtle text-error-hover",
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
