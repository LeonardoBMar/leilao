"use client";

import { BellRing, Car, Gavel, LayoutDashboard, type LucideIcon, Radar, ScanSearch } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";

import { cn } from "@/lib/utils";

type NavItem = { href: Route; label: string; icon: LucideIcon };

// Ordem do DESIGN.md §9.
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/descobertos", label: "Descobertos", icon: Radar },
  { href: "/alertas", label: "Alertas", icon: BellRing },
  { href: "/monitores", label: "Monitores", icon: ScanSearch },
  { href: "/leiloes", label: "Leilões", icon: Gavel },
  { href: "/lotes", label: "Lotes", icon: Car },
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

function ActiveNavList({ onNavigate, badges }: NavLinksProps) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} badges={badges} />;
}

function NavList({ pathname, onNavigate, badges }: NavLinksProps & { pathname: string | null }) {
  return (
    <ul className="grid gap-px">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link
              href={href}
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
