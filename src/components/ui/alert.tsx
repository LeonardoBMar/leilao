import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border p-4", {
  variants: {
    variant: {
      info: "border-info-border bg-info-subtle text-info",
      success: "border-success-border bg-success-subtle text-success",
      warning: "border-warning-border bg-warning-subtle text-warning",
      error: "border-error-border bg-error-subtle text-error",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

const icons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

type AlertProps = React.ComponentProps<"div"> & VariantProps<typeof alertVariants>;

function Alert({ className, variant = "info", children, ...props }: AlertProps) {
  const Icon = icons[variant ?? "info"];

  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert" {...props}>
      <Icon aria-hidden="true" className="mt-0.5 size-5" />
      <div className="grid min-w-0 gap-1 text-foreground">{children}</div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h4">) {
  return <h4 className={cn("text-body font-semibold", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-body text-foreground-secondary", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle, alertVariants };
