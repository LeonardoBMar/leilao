"use client";

import { ChevronRight, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState, useSyncExternalStore } from "react";

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";

import { getAdminRoleServerSnapshot, getAdminRoleSnapshot, subscribeAdminRole } from "./admin-role-store";
import { Brand } from "./brand";
import { CommandPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { NAV_ITEMS, type NavBadges, NavLinks } from "./nav-links";
import { getSidebarServerSnapshot, getSidebarSnapshot, setSidebarCollapsed, subscribeSidebar } from "./sidebar-store";

type RouteContext = {
  section: string;
  sectionHref: Route;
  detail: string | null;
};

function resolveRouteContext(pathname: string | null, isAdmin: boolean): RouteContext | null {
  if (!pathname) return null;
  if (pathname === "/sistema/preferencias" && !isAdmin) {
    return { section: "Preferências", sectionHref: "/sistema/preferencias", detail: null };
  }
  if (pathname === "/sistema" || pathname.startsWith("/sistema/")) {
    const detail =
      pathname === "/sistema/fipe"
        ? "Correções FIPE"
        : pathname === "/sistema/preferencias"
          ? "Preferências"
          : "Coleta";
    return {
      section: "Sistema",
      sectionHref: "/sistema",
      detail,
    };
  }
  const item = NAV_ITEMS.find((entry) =>
    [entry.href, ...(entry.sections ?? [])].some(
      (section) => pathname === section || pathname.startsWith(`${section}/`),
    ),
  );
  if (!item) return null;

  let detail: string | null = null;
  if (pathname === "/dashboard") detail = null;
  else if (pathname === "/leiloes") detail = "Catálogo";
  else if (pathname === "/leiloes/veiculos") detail = "Todos os veículos";
  else if (pathname.startsWith("/leiloes/")) detail = "Leilão do catálogo";
  else if (pathname === "/minhas-analises") detail = "Todos os lotes";
  else if (pathname === "/minhas-analises/leiloes/novo") detail = "Novo leilão";
  else if (pathname.includes("/lotes/novo")) detail = "Novo lote";
  else if (pathname.endsWith("/editar")) detail = "Editar";
  else if (pathname.startsWith("/minhas-analises/leiloes/")) detail = "Leilão";
  else if (pathname.startsWith("/lotes/")) detail = "Ficha do lote";
  else if (pathname.startsWith("/analise/")) detail = "Análise financeira";
  else if (pathname === "/alertas") detail = "Novos lotes";
  else if (pathname === "/monitores") detail = "Monitores";
  else if (pathname === "/monitores/novo") detail = "Novo monitor";
  else if (pathname.startsWith("/monitores/")) detail = "Editar monitor";
  else if (pathname === "/mercado") detail = "Avaliar";
  else if (pathname === "/mercado/panorama") detail = "Panorama";
  else if (pathname === "/mercado/calibracao") detail = "Calibração";

  return { section: item.label, sectionHref: item.href, detail };
}

function HeaderRouteContext() {
  const pathname = usePathname();
  const isAdmin = useSyncExternalStore(subscribeAdminRole, getAdminRoleSnapshot, getAdminRoleServerSnapshot);
  const context = resolveRouteContext(pathname, isAdmin);
  if (!context) return null;

  return (
    <nav aria-label="Localização atual" className="hidden min-w-0 items-center lg:flex">
      <ol className="flex min-w-0 items-center gap-1 text-label">
        <li className="flex min-w-0 items-center">
          {context.detail ? (
            <Link
              href={context.sectionHref}
              title={context.section}
              className="truncate rounded-sm text-muted transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent"
            >
              {context.section}
            </Link>
          ) : (
            <span aria-current="page" title={context.section} className="truncate font-medium text-foreground">
              {context.section}
            </span>
          )}
        </li>
        {context.detail ? (
          <li className="flex min-w-0 items-center gap-1">
            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
            <span aria-current="page" title={context.detail} className="truncate font-medium text-foreground">
              {context.detail}
            </span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

function HideOnDashboard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;
  return <>{children}</>;
}

type AppShellProps = {
  account: ReactNode;
  notifications?: ReactNode;
  badges?: NavBadges;
  followed?: ReactNode;
  nextAuction?: ReactNode;
  commandItems?: ReactNode;
  children: ReactNode;
};

function subscribeNoop() {
  return () => {};
}

function getIsMacSnapshot(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function getIsMacServerSnapshot(): boolean {
  return false;
}

/**
 * Casca privada v3.0 ("Cirúrgico & Monocromático", DESIGN.md §4):
 * Sidebar colapsável à esquerda (264px ↔ 56px) com header próprio de 56px e toggle centralizado na divisão +
 * Coluna principal à direita com header fixo de 56px (breadcrumb, busca centralizada, notificações e conta).
 */
export function AppShell({
  account,
  notifications,
  badges,
  followed,
  nextAuction,
  commandItems,
  children,
}: AppShellProps) {
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot);
  const isMac = useSyncExternalStore(subscribeNoop, getIsMacSnapshot, getIsMacServerSnapshot);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarCollapsed(!getSidebarSnapshot());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh bg-background lg:h-dvh lg:overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3.5 focus:py-2 focus:text-body focus:font-medium focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-accent focus:outline-2 focus:outline-transparent"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar colapsável (desktop lg+) sem borda divisória rígida; toggle integrado no topo */}
      <aside
        aria-label="Navegação lateral"
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col bg-background transition-[width] duration-220 ease-[var(--ease-out)] motion-reduce:transition-none lg:flex",
          collapsed ? "w-14" : "w-66",
        )}
      >
        <div
          className={cn(
            "flex h-12 shrink-0 items-center justify-between pt-2",
            collapsed ? "justify-center px-2.5" : "px-4",
          )}
        >
          <Brand href="/dashboard" compact={collapsed} />

          {!collapsed ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="Recolher barra lateral"
                  aria-expanded={true}
                  aria-controls="sidebar-nav"
                  aria-keyshortcuts="Control+B Meta+B"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-subtle transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:bg-primary-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.95] motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <PanelLeftClose aria-hidden="true" strokeWidth={1.75} className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Recolher barra lateral ({isMac ? "⌘B" : "Ctrl+B"})
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {/* Padding lateral fixo (px-2.5 = 10px) mantém os ícones ancorados no mesmo eixo X durante a animação */}
        <div
          id="sidebar-nav"
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-3",
            !collapsed && "[scrollbar-gutter:stable]",
          )}
        >
          <nav aria-label="Principal" className="w-full">
            <NavLinks badges={badges} collapsed={collapsed} />
          </nav>

          {/* Extras em largura fixa interna (w-61 = 244px) evitam quebra de texto durante o fechamento */}
          <div
            inert={collapsed || undefined}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-5 transition-opacity duration-160 ease-[var(--ease-out)] motion-reduce:transition-none",
              collapsed ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <div className="w-61 shrink-0">
              <Suspense fallback={followed}>
                <HideOnDashboard>{followed}</HideOnDashboard>
              </Suspense>
            </div>
            {nextAuction ? (
              <div className="mt-auto grid w-61 shrink-0 grid-cols-1 gap-2.5 pt-2">{nextAuction}</div>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Coluna principal encaixada (Inset Canvas no desktop lg+) */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:h-dvh lg:min-h-0 lg:p-2 lg:pl-0">
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col bg-surface lg:min-h-0 lg:scroll-pt-14 lg:overflow-y-auto lg:rounded-xl lg:border lg:border-border lg:shadow-xs">
          <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-border bg-surface">
            <div className="mx-auto grid h-full w-full max-w-360 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex min-w-0 items-center gap-2 lg:hidden">
                  <MobileNav badges={badges} followed={followed} nextAuction={nextAuction} />
                  <Brand href="/dashboard" hideLabelOnNarrow />
                </div>
                {collapsed ? (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSidebarCollapsed(false)}
                        aria-label="Expandir barra lateral"
                        aria-expanded={false}
                        aria-controls="sidebar-nav"
                        aria-keyshortcuts="Control+B Meta+B"
                        className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:bg-primary-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.95] motion-reduce:transition-none motion-reduce:active:scale-100 lg:inline-flex"
                      >
                        <PanelLeftOpen aria-hidden="true" strokeWidth={1.75} className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>
                      Expandir barra lateral ({isMac ? "⌘B" : "Ctrl+B"})
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                <Suspense fallback={null}>
                  <HeaderRouteContext />
                </Suspense>
              </div>

              <div className="hidden justify-center md:flex">
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  aria-label={isMac ? "Ir para tela ou buscar (⌘K)" : "Ir para tela ou buscar (Ctrl+K)"}
                  aria-keyshortcuts="Control+K Meta+K"
                  className="inline-flex h-9 w-72 items-center justify-between gap-3 rounded-full border border-border bg-background/80 px-3.5 text-label text-muted transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 xl:w-88 pointer-coarse:h-10"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Search aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
                    <span className="truncate">Ir para tela ou buscar…</span>
                  </span>
                  <kbd className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-caption leading-none text-muted">
                    {isMac ? "⌘K" : "Ctrl K"}
                  </kbd>
                </button>
              </div>

              <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCommandOpen(true)}
                  aria-label={isMac ? "Ir para tela ou buscar (⌘K)" : "Ir para tela ou buscar (Ctrl+K)"}
                  aria-keyshortcuts="Control+K Meta+K"
                  className="size-10 text-muted hover:text-foreground sm:size-8 md:hidden pointer-coarse:size-10"
                >
                  <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
                </Button>
                {notifications}
                {account}
              </div>
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-360 px-4 py-6 outline-none md:px-6 lg:px-8 lg:py-7"
          >
            {children}
          </main>
        </div>
      </div>

      {commandItems}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
