"use client";

import { BellRing, Calculator, ChartColumn, Gavel, House, type LucideIcon } from "lucide-react";
import { LayoutGroup, m } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useId, useSyncExternalStore } from "react";

import { toast, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { MOTION_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

import {
  clearRememberedFilter,
  lastFiltersServerSnapshot,
  lastFiltersSnapshot,
  rememberFilters,
  subscribeLastFilters,
} from "./last-filters";

/** `sections`: outras rotas que pertencem ao item (a ficha do lote e a análise ficam em "Minhas análises"). */
type NavItem = { href: Route; label: string; icon: LucideIcon; sections?: readonly string[] };

// Ordem do DESIGN.md §9.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Início", icon: House },
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
  collapsed?: boolean;
};

/**
 * `usePathname()` é dado de URL: em rotas dinâmicas não existe no pré-render e precisa de <Suspense>.
 * O fallback é a mesma lista sem destaque, então a casca estática já traz a navegação completa.
 */
export function NavLinks({ onNavigate, badges, collapsed = false }: NavLinksProps) {
  return (
    <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} badges={badges} collapsed={collapsed} />}>
      <ActiveNavList onNavigate={onNavigate} badges={badges} collapsed={collapsed} />
    </Suspense>
  );
}

/** Também lembra os filtros de cada lista: o item do menu volta à última busca (D-55). */
function ActiveNavList({ onNavigate, badges, collapsed }: NavLinksProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const saved = useSyncExternalStore(subscribeLastFilters, lastFiltersSnapshot, lastFiltersServerSnapshot);

  useEffect(() => {
    rememberFilters(pathname, searchParams);
  }, [pathname, searchParams]);

  return <NavList pathname={pathname} onNavigate={onNavigate} badges={badges} saved={saved} collapsed={collapsed} />;
}

function NavList({
  pathname,
  onNavigate,
  badges,
  saved,
  collapsed = false,
}: NavLinksProps & { pathname: string | null; saved?: Readonly<Record<string, string>> }) {
  const router = useRouter();
  const groupId = useId();

  const list = (
    <LayoutGroup id={groupId}>
      <ul className="grid gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, sections = [] }) => {
          const isActive =
            pathname !== null &&
            [href, ...sections].some((section) => pathname === section || pathname.startsWith(`${section}/`));
          const target = savedHref(saved?.[href], href);
          const hasRestoredQuery = !isActive && target !== href && target.includes("?");

          const link = (
            <Link
              href={target}
              onClick={() => {
                onNavigate?.();
                if (hasRestoredQuery) {
                  toast.info(`Filtros anteriores restaurados em ${label}.`, {
                    action: {
                      label: "Limpar",
                      onClick: () => {
                        clearRememberedFilter(href);
                        router.push(href);
                      },
                    },
                  });
                }
              }}
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              className={cn(
                "group relative flex h-9 items-center gap-2.5 overflow-clip rounded-md px-2.5 text-label font-medium whitespace-nowrap text-foreground-secondary transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97]",
                isActive ? "font-semibold text-foreground" : "hover:bg-primary-subtle/70 hover:text-foreground",
              )}
            >
              {isActive ? (
                <m.span
                  aria-hidden="true"
                  layoutId="nav-active-pill"
                  transition={MOTION_SPRING}
                  className="pointer-events-none absolute inset-0 rounded-md bg-primary-subtle shadow-[inset_0_0_0_1px_var(--border)]"
                />
              ) : null}
              <Icon
                aria-hidden="true"
                strokeWidth={1.75}
                className={cn(
                  "relative z-10 size-4 shrink-0 text-muted-subtle transition-colors duration-120 group-hover:text-foreground",
                  isActive && "text-foreground",
                )}
              />
              <span
                className={cn(
                  "relative z-10 truncate transition-opacity duration-150 ease-[var(--ease-out)]",
                  collapsed ? "pointer-events-none opacity-0" : "opacity-100",
                )}
              >
                {label}
              </span>
              {badges?.[href] ? (
                collapsed ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1.5 right-1.5 z-10 size-1.5 rounded-full bg-accent empty:hidden"
                  />
                ) : (
                  <span className="relative z-10 ml-auto transition-opacity duration-150 empty:hidden">
                    {badges[href]}
                  </span>
                )
              ) : null}
            </Link>
          );

          return (
            <li key={href}>
              {collapsed ? (
                <Tooltip delayDuration={180}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    </LayoutGroup>
  );

  return list;
}

/** Só aceita o que pertence ao próprio item do menu; qualquer outra coisa volta ao link padrão. */
function savedHref(saved: string | undefined, href: Route): Route {
  return saved !== undefined && (saved === href || saved.startsWith(`${href}/`) || saved.startsWith(`${href}?`))
    ? (saved as Route)
    : href;
}
