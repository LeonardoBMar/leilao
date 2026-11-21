import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default aria-disabled:cursor-default data-[disabled=true]:opacity-55 data-[loading=true]:cursor-wait actionable:active:scale-[0.97] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(17_19_24/0.16)] data-[disabled=true]:bg-primary-disabled actionable:hover:bg-primary-hover actionable:active:bg-primary-active",
        secondary:
          "border border-border-strong bg-surface text-foreground shadow-xs actionable:hover:border-control-border actionable:hover:bg-background actionable:active:bg-surface-subtle",
        outline:
          "border border-accent/40 bg-transparent text-accent actionable:hover:border-accent actionable:hover:bg-accent-subtle actionable:active:bg-accent-subtle",
        ghost:
          "bg-transparent text-foreground-secondary actionable:hover:bg-foreground/5 actionable:hover:text-foreground actionable:active:bg-foreground/8",
        destructive:
          "bg-error text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(190_18_60/0.2)] actionable:hover:bg-error-hover actionable:active:bg-error-active",
        link: "bg-transparent text-accent underline-offset-4 actionable:hover:underline actionable:active:text-accent-hover",
      },
      size: {
        sm: "h-9 px-2.5 text-caption sm:h-8 [&_svg]:size-3.5",
        md: "h-10 px-3.5 text-body sm:h-9 [&_svg]:size-4",
        lg: "h-11 px-4.5 text-body-lg sm:h-10 [&_svg]:size-4.5",
        icon: "size-10 p-0 sm:size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
