import { Gavel } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = Omit<React.ComponentPropsWithoutRef<"a">, "href" | "children"> & {
  href?: "/dashboard";
  compact?: boolean;
  /** Oculta o nome abaixo de `sm` (640 px) para manter o contexto de rota visível no header mobile. */
  hideLabelOnNarrow?: boolean;
  className?: string;
};

/** Marca da casca v3.0 (DESIGN.md §9): quadrado em tinta com martelo e nome em Inter semibold. */
export function Brand({ href, compact = false, hideLabelOnNarrow = false, className, ...props }: BrandProps) {
  const content = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-surface shadow-xs">
        <Gavel aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
      </span>
      <span
        className={cn(
          "overflow-clip text-body leading-none font-semibold tracking-[-0.015em] whitespace-nowrap text-foreground transition-[opacity,max-width] duration-160 ease-[var(--ease-out)] motion-reduce:transition-none",
          compact ? "max-w-0 opacity-0" : "max-w-40 opacity-100",
          hideLabelOnNarrow && "max-sm:sr-only",
        )}
      >
        Leilão Tracker
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={compact ? "Leilão Tracker" : undefined}
        className={cn(
          "inline-flex min-w-0 items-center rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent pointer-coarse:min-h-11",
          compact ? "gap-0" : "gap-2",
          hideLabelOnNarrow &&
            "max-sm:min-h-10 max-sm:min-w-10 max-sm:justify-center max-sm:gap-0 pointer-coarse:min-w-11",
          className,
        )}
        {...props}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex min-w-0 items-center",
        compact ? "gap-0" : "gap-2",
        hideLabelOnNarrow && "max-sm:gap-0",
        className,
      )}
    >
      {content}
    </div>
  );
}
