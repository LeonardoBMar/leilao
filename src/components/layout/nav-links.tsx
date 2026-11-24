"use client";

import {
  BellRing,
  Calculator,
  ChartColumn,
  ChevronRight,
  Database,
  Gavel,
  House,
  type LucideIcon,
  Radar,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { LayoutGroup, m } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useId, useState, useSyncExternalStore } from "react";

import { toast, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { MOTION_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { getAdminRoleServerSnapshot, getAdminRoleSnapshot, subscribeAdminRole } from "./admin-role-store";
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

export const SYSTEM_NAV_ITEMS: readonly NavItem[] = [
  { href: "/sistema", label: "Coleta", icon: Radar },
  { href: "/sistema/fipe", label: "Correções FIPE", icon: Database },
  { href: "/sistema/preferencias", label: "Preferências", icon: SlidersHorizontal },
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
  const systemListId = useId();
  const isAdmin = useSyncExternalStore(subscribeAdminRole, getAdminRoleSnapshot, getAdminRoleServerSnapshot);
  const isSystemActive = pathname !== null && (pathname === "/sistema" || pathname.startsWith("/sistema/"));
  const isPreferencesActive = pathname === "/sistema/preferencias";
  const [systemOpenOverride, setSystemOpenOverride] = useState<boolean | null>(null);
  const systemOpen = systemOpenOverride ?? isSystemActive;

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
                "group relative flex h-10 items-center gap-2.5 overflow-clip rounded-md px-2.5 text-label font-medium whitespace-nowrap text-foreground-secondary transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97] lg:h-9 pointer-coarse:h-11",
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

      {/* Grupo separado: admins veem Sistema (Coleta, FIPE, Preferências); usuários comuns veem só Preferências (D-90) */}
      <div className="mt-2.5 border-t border-border pt-2.5">
        {!isAdmin ? (
          collapsed ? (
            <Tooltip delayDuration={180}>
              <TooltipTrigger asChild>
                <Link
                  href="/sistema/preferencias"
                  onClick={() => onNavigate?.()}
                  aria-current={isPreferencesActive ? "page" : undefined}
                  aria-label="Preferências"
                  className={cn(
                    "group relative flex h-9 items-center gap-2.5 overflow-clip rounded-md px-2.5 text-label font-medium whitespace-nowrap text-foreground-secondary transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97]",
                    isPreferencesActive
                      ? "font-semibold text-foreground"
                      : "hover:bg-primary-subtle/70 hover:text-foreground",
                  )}
                >
                  {isPreferencesActive ? (
                    <m.span
                      aria-hidden="true"
                      layoutId="nav-active-pill"
                      transition={MOTION_SPRING}
                      className="pointer-events-none absolute inset-0 rounded-md bg-primary-subtle shadow-[inset_0_0_0_1px_var(--border)]"
                    />
                  ) : null}
                  <SlidersHorizontal
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className={cn(
                      "relative z-10 size-4 shrink-0 text-muted-subtle transition-colors duration-120 group-hover:text-foreground",
                      isPreferencesActive && "text-foreground",
                    )}
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Preferências
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/sistema/preferencias"
              onClick={() => onNavigate?.()}
              aria-current={isPreferencesActive ? "page" : undefined}
              className={cn(
                "group relative flex h-10 items-center gap-2.5 overflow-clip rounded-md px-2.5 text-label font-medium whitespace-nowrap text-foreground-secondary transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97] lg:h-9 pointer-coarse:h-11",
                isPreferencesActive
                  ? "font-semibold text-foreground"
                  : "hover:bg-primary-subtle/70 hover:text-foreground",
              )}
            >
              {isPreferencesActive ? (
                <m.span
                  aria-hidden="true"
                  layoutId="nav-active-pill"
                  transition={MOTION_SPRING}
                  className="pointer-events-none absolute inset-0 rounded-md bg-primary-subtle shadow-[inset_0_0_0_1px_var(--border)]"
                />
              ) : null}
              <SlidersHorizontal
                aria-hidden="true"
                strokeWidth={1.75}
                className={cn(
                  "relative z-10 size-4 shrink-0 text-muted-subtle transition-colors duration-120 group-hover:text-foreground",
                  isPreferencesActive && "text-foreground",
                )}
              />
              <span className="relative z-10 truncate">Preferências</span>
            </Link>
          )
        ) : collapsed ? (
          <Tooltip delayDuration={180}>
            <TooltipTrigger asChild>
              <Link
                href="/sistema"
                onClick={() => onNavigate?.()}
                aria-current={isSystemActive ? "page" : undefined}
                aria-label="Sistema"
                className={cn(
                  "group relative flex h-9 items-center gap-2.5 overflow-clip rounded-md px-2.5 text-label font-medium whitespace-nowrap text-foreground-secondary transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97]",
                  isSystemActive ? "font-semibold text-foreground" : "hover:bg-primary-subtle/70 hover:text-foreground",
                )}
              >
                {isSystemActive ? (
                  <m.span
                    aria-hidden="true"
                    layoutId="nav-active-pill"
                    transition={MOTION_SPRING}
                    className="pointer-events-none absolute inset-0 rounded-md bg-primary-subtle shadow-[inset_0_0_0_1px_var(--border)]"
                  />
                ) : null}
                <Settings
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className={cn(
                    "relative z-10 size-4 shrink-0 text-muted-subtle transition-colors duration-120 group-hover:text-foreground",
                    isSystemActive && "text-foreground",
                  )}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              Sistema
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="grid gap-0.5">
            <button
              type="button"
              onClick={() => setSystemOpenOverride(!systemOpen)}
              aria-expanded={systemOpen}
              aria-controls={systemListId}
              className={cn(
                "group relative flex h-10 w-full items-center gap-2.5 overflow-clip rounded-md px-2.5 text-left text-label font-medium whitespace-nowrap text-foreground-secondary transition-[background-color,color] duration-150 ease-[var(--ease-out)] outline-none hover:bg-primary-subtle/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent lg:h-9 pointer-coarse:h-11",
                isSystemActive && "font-semibold text-foreground",
              )}
            >
              <Settings
                aria-hidden="true"
                strokeWidth={1.75}
                className={cn(
                  "size-4 shrink-0 text-muted-subtle transition-colors duration-120 group-hover:text-foreground",
                  isSystemActive && "text-foreground",
                )}
              />
              <span className="min-w-0 flex-1 truncate">Sistema</span>
              <ChevronRight
                aria-hidden="true"
                strokeWidth={1.75}
                className={cn(
                  "size-3.5 shrink-0 text-muted-subtle transition-transform duration-150 ease-[var(--ease-out)]",
                  systemOpen && "rotate-90",
                )}
              />
            </button>

            {systemOpen ? (
              <ul id={systemListId} className="grid gap-0.5 pl-4">
                {SYSTEM_NAV_ITEMS.map(({ href, label, icon: SubIcon }) => {
                  const isSubActive =
                    href === "/sistema"
                      ? pathname === href
                      : pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => onNavigate?.()}
                        aria-current={isSubActive ? "page" : undefined}
                        className={cn(
                          "group relative flex h-10 items-center gap-2 rounded-md px-2.5 text-label font-medium whitespace-nowrap text-foreground-secondary transition-[background-color,color] duration-150 ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent lg:h-9 pointer-coarse:h-11",
                          isSubActive
                            ? "bg-primary-subtle font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                            : "hover:bg-primary-subtle/70 hover:text-foreground",
                        )}
                      >
                        <SubIcon
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className={cn(
                            "size-3.5 shrink-0 text-muted-subtle group-hover:text-foreground",
                            isSubActive && "text-foreground",
                          )}
                        />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        )}
      </div>
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
