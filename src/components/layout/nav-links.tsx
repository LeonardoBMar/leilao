"use client";

import { BellRing, Calculator, ChartColumn, Gavel, LayoutDashboard, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

import { lastFiltersServerSnapshot, lastFiltersSnapshot, rememberFilters, subscribeLastFilters } from "./last-filters";

/** `sections`: outras rotas que pertencem ao item (a ficha do lote e a análise ficam em "Minhas análises"). */
type NavItem = { href: Route; label: string; icon: LucideIcon; sections?: readonly string[] };

// Ordem do DESIGN.md §9.
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leiloes", label: "Leilões", icon: Gavel },
  { href: "/minhas-analises", label: "Minhas análises", icon: Calculator, sections: ["/lotes", "/analise"] },
  { href: "/alertas", label: "Alertas", icon: BellRing, sections: ["/monitores"] },
  { href: "/mercado", label: "Mercado", icon: ChartColumn },
];

/** Conteúdo ao lado do item, renderizado no servidor (ex.: contador de alertas não lidos, DESIGN.md §9). */
export type NavBadges = Partial<Record<Route, ReactNode>>;

type NavLinksProps = {
  onNavigate?: () => void;
  badges?: NavBadges;
};

/**
 * `usePathname()` é dado de URL: em rotas dinâmicas não existe no pré-render e precisa de <Suspense>.
 * O fallback é a mesma lista sem destaque, então a casca estática já traz a navegação completa.
 */
export function NavLinks({ onNavigate, badges }: NavLinksProps) {
  return (
    <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} badges={badges} />}>
      <ActiveNavList onNavigate={onNavigate} badges={badges} />
    </Suspense>
  );
}

/** Também lembra os filtros de cada lista: o item do menu volta à última busca (D-55). */
function ActiveNavList({ onNavigate, badges }: NavLinksProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const saved = useSyncExternalStore(subscribeLastFilters, lastFiltersSnapshot, lastFiltersServerSnapshot);

  useEffect(() => {
    rememberFilters(pathname, searchParams);
  }, [pathname, searchParams]);

  return <NavList pathname={pathname} onNavigate={onNavigate} badges={badges} saved={saved} />;
}

function NavList({
  pathname,
  onNavigate,
  badges,
  saved,
}: NavLinksProps & { pathname: string | null; saved?: Readonly<Record<string, string>> }) {
  return (
    <ul className="grid gap-px">
      {NAV_ITEMS.map(({ href, label, icon: Icon, sections = [] }) => {
        const isActive =
          pathname !== null &&
          [href, ...sections].some((section) => pathname === section || pathname.startsWith(`${section}/`));
        return (
          <li key={href}>
            <Link
              href={savedHref(saved?.[href], href)}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-body font-medium text-foreground-secondary transition-colors duration-120 outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
                isActive && "bg-surface font-semibold text-foreground shadow-sm hover:bg-surface",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0 text-muted-subtle transition-colors duration-120 group-hover:text-foreground",
                  isActive && "text-foreground",
                )}
              />
              {label}
              {badges?.[href]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Só aceita o que pertence ao próprio item do menu; qualquer outra coisa volta ao link padrão. */
function savedHref(saved: string | undefined, href: Route): Route {
  return saved !== undefined && (saved === href || saved.startsWith(`${href}/`) || saved.startsWith(`${href}?`))
    ? (saved as Route)
    : href;
}
