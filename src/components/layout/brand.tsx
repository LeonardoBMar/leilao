import { Gavel } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = {
  href?: "/dashboard";
  className?: string;
};

/** Marca da casca v3.0 (DESIGN.md §9): quadrado em tinta com martelo e nome em Inter semibold. */
export function Brand({ href, className }: BrandProps) {
  const content = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-white shadow-xs">
        <Gavel aria-hidden="true" className="size-3.5" />
      </span>
      <span className="text-body leading-none font-semibold tracking-[-0.015em] text-foreground">Leilão Tracker</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-2 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn("inline-flex items-center gap-2", className)}>{content}</div>;
}
