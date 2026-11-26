"use client";

import { ChevronRight, CircleAlert, CircleCheck, type LucideIcon, Minus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useId, useState } from "react";

import type { LimitComparison } from "@/domain/finance/calculator";
import { LIMIT_COMPARISON_LABELS } from "@/lib/limit-comparison";
import { cn } from "@/lib/utils";

const STATUS_META = {
  below_limit: { icon: CircleCheck, className: "text-success" },
  at_limit: { icon: TriangleAlert, className: "text-warning" },
  above_limit: { icon: CircleAlert, className: "text-error" },
  no_viable_bid: { icon: Minus, className: "text-muted-subtle" },
  unavailable: { icon: Minus, className: "text-muted-subtle" },
} as const satisfies Record<LimitComparison, { icon: LucideIcon; className: string }>;

export type FollowedLotNavItem = {
  id: string;
  model: string;
  modelYear: number | null;
  lotNumber: string;
  comparison: LimitComparison;
};

type FollowedLotsNavListProps = {
  items: readonly FollowedLotNavItem[];
  totalCount: number;
  hasMore: boolean;
};

/**
 * Seção colapsável "Acompanhando" com micro-rótulo tipográfico e destaque ativo paper-lift (padrão Linear/Attio).
 * `usePathname()` é dado de URL e precisa de <Suspense>; o fallback mostra a lista sem destaque.
 */
export function FollowedLotsNavList({ items, totalCount, hasMore }: FollowedLotsNavListProps) {
  return (
    <Suspense fallback={<LotSection items={items} totalCount={totalCount} hasMore={hasMore} pathname={null} />}>
      <ActiveLotSection items={items} totalCount={totalCount} hasMore={hasMore} />
    </Suspense>
  );
}

function ActiveLotSection({ items, totalCount, hasMore }: FollowedLotsNavListProps) {
  const pathname = usePathname();
  return <LotSection items={items} totalCount={totalCount} hasMore={hasMore} pathname={pathname} />;
}

function LotSection({ items, totalCount, hasMore, pathname }: FollowedLotsNavListProps & { pathname: string | null }) {
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <nav aria-label="Lotes acompanhados" className="grid grid-cols-1 gap-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={listId}
        className="group flex min-h-10 w-full items-center gap-1.5 rounded-md px-2.5 text-left font-mono text-overline font-medium text-muted uppercase transition-colors duration-150 ease-[var(--ease-out)] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent motion-reduce:transition-none lg:min-h-7 pointer-coarse:min-h-11"
      >
        <ChevronRight
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn(
            "size-3 shrink-0 text-muted-subtle transition-transform duration-150 ease-[var(--ease-out)] group-hover:text-foreground motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
        <span>Acompanhando</span>
        <span className="ml-auto font-mono text-caption font-normal text-muted tabular-nums">{totalCount}</span>
      </button>

      {open ? (
        <div id={listId} className="grid grid-cols-1 gap-1">
          <ul className="grid grid-cols-1 gap-0.5">
            {items.map((lot) => {
              const href = `/lotes/${lot.id}` as const;
              const isActive = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
              const { icon: StatusIcon, className: statusClassName } = STATUS_META[lot.comparison];
              return (
                <li key={lot.id}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-label font-medium text-foreground-secondary transition-colors duration-120 outline-none hover:bg-primary-subtle/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent motion-reduce:transition-none lg:min-h-9 pointer-coarse:min-h-11",
                      isActive &&
                        "bg-primary-subtle font-semibold text-foreground ring-1 ring-border ring-inset hover:bg-primary-subtle",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      title={LIMIT_COMPARISON_LABELS[lot.comparison]}
                      className="flex w-4 shrink-0 justify-center"
                    >
                      <StatusIcon strokeWidth={2} className={cn("size-3.5", statusClassName)} />
                    </span>
                    {/* `relative` prende o `sr-only` (absoluto) ao nome cortado: sem ele, o texto oculto fica no fim do nome
                        inteiro, fora do corte, e cria rolagem horizontal no menu. */}
                    <span
                      title={lot.modelYear !== null ? `${lot.model} ${lot.modelYear}` : lot.model}
                      className="relative min-w-0 flex-1 truncate"
                    >
                      {lot.modelYear !== null ? `${lot.model} ${lot.modelYear}` : lot.model}
                      <span className="sr-only">: {LIMIT_COMPARISON_LABELS[lot.comparison]}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-caption font-normal text-muted tabular-nums",
                        isActive && "text-foreground-secondary",
                      )}
                    >
                      {lot.lotNumber}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <Link
              href="/minhas-analises?acompanhados=1&resultado=sem"
              className="inline-flex min-h-10 items-center rounded-md px-2.5 text-caption text-muted outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent lg:min-h-7 pointer-coarse:min-h-11"
            >
              Ver todos
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
