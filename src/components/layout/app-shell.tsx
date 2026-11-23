"use client";

import { ChevronRight, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState, useSyncExternalStore } from "react";

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";

import { Brand } from "./brand";
import { CommandPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { NAV_ITEMS, type NavBadges, NavLinks } from "./nav-links";

const SIDEBAR_STORAGE_KEY = "leilao.sidebar-collapsed";

const sidebarListeners = new Set<() => void>();

function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

function getSidebarSnapshot(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

function setSidebarCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Modo privado ou quota excedida: mantém sem quebrar.
  }
  for (const listener of sidebarListeners) {
    listener();
  }
}

function resolveRouteContext(pathname: string | null) {
  if (!pathname) return null;
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

  return { icon: item.icon, section: item.label, detail };
}

function HeaderRouteContext() {
  const pathname = usePathname();
  const context = resolveRouteContext(pathname);
  if (!context) return null;

  const Icon = context.icon;

  return (
    <div className="hidden min-w-0 items-center gap-1.5 text-label lg:flex">
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0 text-muted-subtle" />
      <span className="truncate font-medium text-foreground">{context.section}</span>
      {context.detail ? (
        <>
          <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
          <span className="truncate text-muted">{context.detail}</span>
        </>
      ) : null}
    </div>
  );
}

function HideOnDashboard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;
  return <>{children}</>;
}

type AppShellProps = {
  account: ReactNode;
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
 * Sidebar colapsável à esquerda (264px ↔ 56px) com header próprio de 48px e transição suave (220ms --ease-out) +
 * Coluna principal à direita com header fixo de 48px alinhado à mesma linha hairline + Canvas branco puro.
 */
export function AppShell({ account, badges, followed, nextAuction, commandItems, children }: AppShellProps) {
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
    <div className="flex min-h-dvh bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3.5 focus:py-2 focus:text-body focus:font-medium focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-accent focus:outline-2 focus:outline-transparent"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar colapsável (desktop lg+) com header próprio de 48px e animação suave de largura */}
      <aside
        aria-label="Navegação lateral"
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-clip border-r border-border bg-background transition-[width] duration-220 ease-[var(--ease-out)] [contain:layout_style] motion-reduce:transition-none lg:flex",
          collapsed ? "w-14" : "w-66",
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-2.5">
          <div
            inert={collapsed || undefined}
            className={cn(
              "min-w-0 overflow-clip pl-1 whitespace-nowrap transition-opacity duration-160 ease-[var(--ease-out)] motion-reduce:transition-none",
              collapsed ? "pointer-events-none w-0 opacity-0" : "opacity-100",
            )}
          >
            <Brand href="/dashboard" />
          </div>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!collapsed)}
                aria-label="Barra lateral"
                aria-expanded={!collapsed}
                aria-controls="sidebar-nav"
                aria-keyshortcuts="Control+B Meta+B"
                className="shrink-0 text-muted hover:text-foreground"
              >
                {collapsed ? (
                  <PanelLeftOpen aria-hidden="true" strokeWidth={1.75} className="size-4" />
                ) : (
                  <PanelLeftClose aria-hidden="true" strokeWidth={1.75} className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} ({isMac ? "⌘B" : "Ctrl+B"})
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Padding lateral fixo (px-2.5 = 10px) mantém os ícones ancorados no mesmo eixo X durante a animação */}
        <div
          id="sidebar-nav"
          className="flex min-h-0 flex-1 [scrollbar-gutter:stable] flex-col gap-5 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-3.5"
        >
          <nav aria-label="Principal" className="w-full">
            <NavLinks badges={badges} collapsed={collapsed} />
          </nav>

          {/* Extras e conta em largura fixa interna (w-61 = 244px) evitam quebra de texto durante o fechamento */}
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
            <div className="mt-auto grid w-61 shrink-0 grid-cols-1 gap-2.5 pt-2">
              {nextAuction}
              <div className="border-t border-border pt-2.5">{account}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Coluna principal à direita da sidebar: header próprio de 48px + canvas */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col bg-surface">
        <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex items-center gap-2 lg:hidden">
              <MobileNav account={account} badges={badges} followed={followed} nextAuction={nextAuction} />
              <Brand href="/dashboard" />
            </div>
            <Suspense fallback={null}>
              <HeaderRouteContext />
            </Suspense>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label={isMac ? "Ir para tela ou buscar (⌘K)" : "Ir para tela ou buscar (Ctrl+K)"}
              aria-keyshortcuts="Control+K Meta+K"
              className="inline-flex h-10 items-center justify-between gap-3 rounded-md border border-border-strong bg-background px-2.5 text-label text-muted shadow-xs transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:border-control-border hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97] sm:h-8 sm:w-64 md:w-76 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <Search aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
                <span className="hidden truncate sm:inline">Ir para tela ou buscar…</span>
              </span>
              <kbd className="hidden shrink-0 rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-caption leading-none text-muted sm:inline-block">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            </button>
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

      {commandItems}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
