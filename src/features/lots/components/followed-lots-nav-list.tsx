"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import type { LimitComparison } from "@/domain/finance/calculator";
import { LIMIT_COMPARISON_LABELS } from "@/lib/limit-comparison";
import { cn } from "@/lib/utils";

const DOT = {
  below_limit: "bg-success",
  at_limit: "bg-warning",
  above_limit: "bg-error",
  no_viable_bid: "bg-muted-subtle",
  unavailable: "bg-muted-subtle",
} as const satisfies Record<LimitComparison, string>;

export type FollowedLotNavItem = {
  id: string;
  model: string;
  modelYear: number | null;
  lotNumber: string;
  comparison: LimitComparison;
};

type FollowedLotsNavListProps = {
  items: readonly FollowedLotNavItem[];
};

/**
 * Lista clicável de "Acompanhando" com destaque ativo sem borda (DESIGN.md §9).
 * `usePathname()` é dado de URL e precisa de <Suspense>; o fallback mostra a lista sem destaque.
 */
export function FollowedLotsNavList({ items }: FollowedLotsNavListProps) {
  return (
    <Suspense fallback={<LotList items={items} pathname={null} />}>
      <ActiveLotList items={items} />
    </Suspense>
  );
}

function ActiveLotList({ items }: FollowedLotsNavListProps) {
  const pathname = usePathname();
  return <LotList items={items} pathname={pathname} />;
}

function LotList({ items, pathname }: FollowedLotsNavListProps & { pathname: string | null }) {
  return (
    <ul className="grid grid-cols-1 gap-px">
      {items.map((lot) => {
        const href = `/lotes/${lot.id}` as const;
        const isActive = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <li key={lot.id}>
            <Link
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-body font-medium text-foreground-secondary transition-colors duration-120 outline-none hover:bg-primary-subtle/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
                isActive && "bg-primary-subtle font-semibold text-foreground hover:bg-primary-subtle",
              )}
            >
              <span aria-hidden="true" className="flex w-4 shrink-0 justify-center">
                <span className={cn("size-1.75 rounded-full", DOT[lot.comparison])} />
              </span>
              {/* `relative` prende o `sr-only` (absoluto) ao nome cortado: sem ele, o texto oculto fica no fim do nome
                  inteiro, fora do corte, e cria rolagem horizontal no menu. */}
              <span className="relative min-w-0 flex-1 truncate">
                {lot.modelYear !== null ? `${lot.model} ${lot.modelYear}` : lot.model}
                <span className="sr-only">: {LIMIT_COMPARISON_LABELS[lot.comparison]}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-caption font-normal text-muted",
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
  );
}
