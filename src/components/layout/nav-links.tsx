"use client";

import { LayoutDashboard, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = { href: Route; label: string; icon: LucideIcon };

// Ordem do DESIGN.md §9. Leilões e Lotes entram quando as rotas existirem.
const NAV_ITEMS: readonly NavItem[] = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];

type NavLinksProps = {
  onNavigate?: () => void;
};

export function NavLinks({ onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <ul className="grid gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 text-label text-foreground-secondary transition-colors duration-120 outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-primary",
                isActive && "bg-primary-subtle font-semibold text-primary-active hover:bg-primary-subtle",
              )}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
