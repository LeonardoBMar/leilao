import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default aria-disabled:cursor-default data-[disabled=true]:opacity-60 data-[loading=true]:cursor-wait [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white data-[disabled=true]:bg-primary-disabled actionable:hover:bg-primary-hover actionable:active:bg-primary-active",
        secondary:
          "border border-control-border bg-surface text-foreground actionable:hover:bg-surface-subtle actionable:active:bg-border/60",
        outline:
          "border border-primary bg-transparent text-primary actionable:hover:bg-primary-subtle actionable:active:bg-primary-subtle-hover",
        ghost:
          "bg-transparent text-foreground-secondary actionable:hover:bg-surface-subtle actionable:hover:text-foreground actionable:active:bg-border/60",
        destructive: "bg-error text-white actionable:hover:bg-error-hover actionable:active:bg-error-active",
        link: "bg-transparent text-primary underline-offset-4 actionable:hover:underline actionable:active:text-primary-active",
      },
      size: {
        sm: "h-10 px-3 text-caption [&_svg]:size-4",
        md: "h-10 px-4 text-body [&_svg]:size-4",
        lg: "h-12 px-5 text-body-lg [&_svg]:size-5",
        icon: "size-10 p-0 [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
