import { Gavel } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = {
  href?: "/dashboard";
  compact?: boolean;
  /** Oculta o nome abaixo de 360 px para evitar overflow horizontal em viewports estreitos (320 px). */
  hideLabelOnNarrow?: boolean;
  className?: string;
};

/** Marca da casca v3.0 (DESIGN.md §9): quadrado em tinta com martelo e nome em Inter semibold. */
export function Brand({ href, compact = false, hideLabelOnNarrow = false, className }: BrandProps) {
  const content = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-white shadow-xs">
        <Gavel aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
      </span>
      <span
        className={cn(
          "overflow-clip text-body leading-none font-semibold tracking-[-0.015em] whitespace-nowrap text-foreground transition-[opacity,max-width] duration-160 ease-[var(--ease-out)] motion-reduce:transition-none",
          compact ? "max-w-0 opacity-0" : "max-w-40 opacity-100",
          hideLabelOnNarrow && "max-[359px]:sr-only",
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
          "inline-flex min-w-0 items-center rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent",
          compact ? "gap-0" : "gap-2",
          hideLabelOnNarrow && "max-[359px]:gap-0",
          className,
        )}
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
        hideLabelOnNarrow && "max-[359px]:gap-0",
        className,
      )}
    >
      {content}
    </div>
  );
}
