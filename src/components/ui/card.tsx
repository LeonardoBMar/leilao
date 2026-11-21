import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-lg border border-border bg-surface text-foreground", {
  variants: {
    variant: {
      default: "",
      metric: "",
      summary: "border-border bg-surface-subtle",
      interactive:
        "transition-[border-color,background-color,box-shadow] duration-150 ease-[var(--ease-out)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-transparent hover:border-border-strong hover:bg-background hover:shadow-xs",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type CardProps = React.ComponentProps<"div"> & VariantProps<typeof cardVariants>;

function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 p-5 pb-0 md:p-6 md:pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-heading-3", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-body text-foreground-secondary", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 md:p-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-3 border-t border-border p-5 md:flex-row md:items-center md:p-6",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants };
