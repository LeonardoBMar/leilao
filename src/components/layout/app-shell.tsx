"use client";

import { type LucideIcon, PanelLeftClose, PanelLeftOpen, Search, Settings, SlidersHorizontal } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";

import { getAdminRoleServerSnapshot, getAdminRoleSnapshot, subscribeAdminRole } from "./admin-role-store";
import { Brand } from "./brand";
import { CommandPalette } from "./command-palette";
import {
  getCommandItemsServerSnapshot,
  getCommandItemsSnapshot,
  type QuickJumpItem,
  subscribeCommandItems,
} from "./command-palette-store";
import { GlobalGuideDialog } from "./global-guide-dialog";
import { setGuideDialogOpen } from "./guide-dialog-store";
import { MobileNav } from "./mobile-nav";
import { NAV_ITEMS, type NavBadges, NavLinks } from "./nav-links";
import { getSidebarServerSnapshot, getSidebarSnapshot, setSidebarCollapsed, subscribeSidebar } from "./sidebar-store";
import { useIsMac } from "./use-is-mac";

type RouteContext = {
  section: string;
  sectionHref: Route;
  icon: LucideIcon;
  detail: string | null;
  detailMono?: boolean;
};

function resolveLotBreadcrumb(pathname: string, commandItems: readonly QuickJumpItem[]): string | null {
  const match = commandItems.find((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`));
  if (!match?.meta) return null;
  const lotSegment = match.meta.split("·")[0]?.trim();
  return lotSegment ? lotSegment.toUpperCase() : null;
}

function resolveRouteContext(
  pathname: string | null,
  isAdmin: boolean,
  commandItems: readonly QuickJumpItem[],
): RouteContext | null {
  if (!pathname) return null;
  if (pathname === "/sistema/preferencias" && !isAdmin) {
    return {
      section: "Preferências",
      sectionHref: "/sistema/preferencias",
      icon: SlidersHorizontal,
      detail: null,
    };
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
      icon: Settings,
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
  let detailMono = false;
  if (pathname === "/dashboard") detail = null;
  else if (pathname === "/leiloes") detail = "Catálogo";
  else if (pathname === "/leiloes/veiculos") detail = "Todos os veículos";
  else if (pathname.startsWith("/leiloes/")) detail = "Leilão do catálogo";
  else if (pathname === "/minhas-analises") detail = "Todos os lotes";
  else if (pathname === "/minhas-analises/leiloes/novo") detail = "Novo leilão";
  else if (pathname.includes("/lotes/novo")) detail = "Novo lote";
  else if (pathname.endsWith("/editar")) detail = "Editar";
  else if (pathname.startsWith("/minhas-analises/leiloes/")) detail = "Leilão";
  else if (pathname.startsWith("/lotes/")) {
    const lotCode = resolveLotBreadcrumb(pathname, commandItems);
    detail = lotCode ?? "Ficha do lote";
    detailMono = lotCode !== null;
  } else if (pathname.startsWith("/analise/")) detail = "Análise financeira";
  else if (pathname === "/alertas") detail = "Novos lotes";
  else if (pathname === "/monitores") detail = null;
  else if (pathname === "/monitores/novo") detail = "Novo monitor";
  else if (pathname.startsWith("/monitores/")) detail = "Editar monitor";
  else if (pathname === "/mercado") detail = "Avaliar";
  else if (pathname === "/mercado/panorama") detail = "Panorama";
  else if (pathname === "/mercado/calibracao") detail = "Calibração";

  return { section: item.label, sectionHref: item.href, icon: item.icon, detail, detailMono };
}

function HeaderRouteContext() {
  const pathname = usePathname();
  const isAdmin = useSyncExternalStore(subscribeAdminRole, getAdminRoleSnapshot, getAdminRoleServerSnapshot);
  const commandItems = useSyncExternalStore(
    subscribeCommandItems,
    getCommandItemsSnapshot,
    getCommandItemsServerSnapshot,
  );
  const context = resolveRouteContext(pathname, isAdmin, commandItems);
  if (!context) return null;

  const SectionIcon = context.icon;

  return (
    <nav aria-label="Localização atual" className="flex min-w-0 items-center">
      <span
        aria-hidden="true"
        className="mr-2 shrink-0 font-mono text-caption text-border-strong select-none lg:hidden"
      >
        /
      </span>
      <ol className="flex min-w-0 items-center gap-2 text-label">
        <li className={cn("min-w-0 items-center", context.detail ? "hidden sm:flex" : "flex")}>
          {context.detail ? (
            <Link
              href={context.sectionHref}
              title={context.section}
              className="-my-1.5 inline-flex min-w-0 items-center gap-1.5 rounded-sm py-1.5 text-muted transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent motion-reduce:transition-none"
            >
              <SectionIcon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0 text-muted-subtle" />
              <span className="truncate">{context.section}</span>
            </Link>
          ) : (
            <span
              aria-current="page"
              title={context.section}
              className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground"
            >
              <SectionIcon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0 text-muted" />
              <span className="truncate">{context.section}</span>
            </span>
          )}
        </li>
        {context.detail ? (
          <li className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="hidden shrink-0 font-mono text-caption text-border-strong select-none sm:inline"
            >
              /
            </span>
            <span
              aria-current="page"
              title={context.detail}
              className={cn(
                "truncate font-medium text-foreground",
                context.detailMono && "font-mono text-caption tracking-[0.02em]",
              )}
            >
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

/** Reseta o scroll do painel encaixado ao trocar de rota no desktop (o App Router só reseta `window`). */
function ResetCanvasScrollOnNavigate({ canvasRef }: { canvasRef: React.RefObject<HTMLDivElement | null> }) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    if (window.location.hash) return;
    canvasRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, canvasRef]);

  return null;
}

type AppShellProps = {
  account: ReactNode;
  sidebarAccount?: ReactNode;
  notifications?: ReactNode;
  badges?: NavBadges;
  followed?: ReactNode;
  nextAuction?: ReactNode;
  commandItems?: ReactNode;
  children: ReactNode;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Casca privada ("Cirúrgico & Monocromático", DESIGN.md §4):
 * Sidebar colapsável em papel (`bg-background`, 264px ↔ 56px) com busca integrada e dock da conta no rodapé +
 * Canvas branco (`bg-surface`) à direita com header compacto de 48px.
 */
export function AppShell({
  account,
  sidebarAccount,
  notifications,
  badges,
  followed,
  nextAuction,
  commandItems,
  children,
}: AppShellProps) {
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot);
  const isMac = useIsMac();
  const [commandOpen, setCommandOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sidebarFade, setSidebarFade] = useState({ top: false, bottom: false });
  const [sidebarTransitionReady, setSidebarTransitionReady] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sidebarNavRef = useRef<HTMLDivElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSidebarTransitionReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      if (!event.altKey && !event.ctrlKey && !event.metaKey && event.key === "?") {
        event.preventDefault();
        setGuideDialogOpen(true);
        return;
      }
      if (event.altKey || event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "b") return;
      if (!window.matchMedia("(min-width: 64rem)").matches) return;
      event.preventDefault();
      setSidebarCollapsed(!getSidebarSnapshot());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    function updateScrolled() {
      const next = (canvas?.scrollTop ?? 0) > 4 || window.scrollY > 4;
      setScrolled((prev) => (prev === next ? prev : next));
    }

    updateScrolled();
    canvas?.addEventListener("scroll", updateScrolled, { passive: true });
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => {
      canvas?.removeEventListener("scroll", updateScrolled);
      window.removeEventListener("scroll", updateScrolled);
    };
  }, []);

  useEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return;

    function updateFade() {
      if (!nav) return;
      const top = nav.scrollTop > 4;
      const bottom = nav.scrollTop + nav.clientHeight < nav.scrollHeight - 4;
      setSidebarFade((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    }

    updateFade();
    nav.addEventListener("scroll", updateFade, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateFade) : null;
    observer?.observe(nav);
    if (sidebarContentRef.current) {
      observer?.observe(sidebarContentRef.current);
    }
    return () => {
      nav.removeEventListener("scroll", updateFade);
      observer?.disconnect();
    };
  }, [collapsed]);

  const sidebarMaskClass =
    sidebarFade.top && sidebarFade.bottom
      ? "[mask-image:linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]"
      : sidebarFade.top
        ? "[mask-image:linear-gradient(to_bottom,transparent,black_16px,black)]"
        : sidebarFade.bottom
          ? "[mask-image:linear-gradient(to_bottom,black,black_calc(100%-16px),transparent)]"
          : undefined;

  return (
    <div className="flex min-h-dvh bg-background lg:h-dvh lg:overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3.5 focus:py-2 focus:text-body focus:font-medium focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-accent focus:outline-2 focus:outline-transparent"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar colapsável em papel (desktop lg+) com toggle integrado no topo */}
      <aside
        aria-label="Navegação lateral"
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-r border-border bg-background lg:flex",
          sidebarTransitionReady &&
            "transition-[width] duration-220 ease-[var(--ease-out)] motion-reduce:transition-none",
          collapsed ? "w-14" : "w-66",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center",
            collapsed ? "flex-col gap-2 px-2.5 pt-2 pb-0.5" : "h-12 justify-between pr-2.5 pl-4",
          )}
        >
          <Brand href="/dashboard" compact={collapsed} />

          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!collapsed)}
                aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
                aria-expanded={!collapsed}
                aria-controls="sidebar-nav"
                aria-keyshortcuts="Control+B Meta+B"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center rounded-md text-muted-subtle transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:bg-primary-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.95] motion-reduce:transition-none motion-reduce:active:scale-100",
                  collapsed ? "h-9 w-full pointer-coarse:h-11" : "size-8 pointer-coarse:size-10",
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen aria-hidden="true" strokeWidth={1.75} className="size-4" />
                ) : (
                  <PanelLeftClose aria-hidden="true" strokeWidth={1.75} className="size-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} ({isMac ? "⌘B" : "Ctrl+B"})
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Gatilho da paleta de comandos integrado ao topo da sidebar (padrão Linear/Attio) */}
        <div className="shrink-0 px-2.5 pt-2 pb-1">
          <Tooltip delayDuration={180} open={collapsed ? undefined : false}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label={isMac ? "Ir para tela ou buscar (⌘K)" : "Ir para tela ou buscar (Ctrl+K)"}
                aria-keyshortcuts="Control+K Meta+K"
                className={cn(
                  "flex h-9 w-full items-center rounded-md border border-border bg-surface text-label text-muted transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:border-border-strong hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:h-11",
                  collapsed ? "justify-center px-0" : "justify-between gap-2 px-2.5",
                )}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Search aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-muted-subtle" />
                  {!collapsed ? <span className="truncate">Buscar…</span> : null}
                </span>
                {!collapsed ? (
                  <kbd className="shrink-0 rounded-sm border border-border/70 bg-surface px-1.5 py-0.5 font-mono text-caption leading-none text-muted">
                    {isMac ? "⌘K" : "Ctrl K"}
                  </kbd>
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              Buscar ({isMac ? "⌘K" : "Ctrl+K"})
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Padding lateral fixo (px-2.5 = 10px) mantém os ícones ancorados no mesmo eixo X durante a animação */}
        <div
          ref={sidebarNavRef}
          id="sidebar-nav"
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-2.5",
            !collapsed && "[scrollbar-gutter:stable]",
            sidebarMaskClass,
          )}
        >
          <div ref={sidebarContentRef} className="flex min-h-full flex-col gap-5">
            <nav aria-label="Principal" className="w-full">
              <NavLinks badges={badges} collapsed={collapsed} />
            </nav>

            {/* Extras removidos do fluxo no modo colapsado para evitar scroll fantasma na rail */}
            <div inert={collapsed || undefined} className={collapsed ? "hidden" : "flex min-h-0 flex-1 flex-col gap-5"}>
              <div className="w-full min-w-0">
                <Suspense fallback={followed}>
                  <HideOnDashboard>{followed}</HideOnDashboard>
                </Suspense>
              </div>
              {nextAuction ? (
                <div className="mt-auto grid w-full min-w-0 grid-cols-1 gap-2.5 pt-2">{nextAuction}</div>
              ) : null}
            </div>
          </div>
        </div>

        {sidebarAccount ? <div className="shrink-0 border-t border-border/70 px-2.5 py-2">{sidebarAccount}</div> : null}
      </aside>

      {/* Coluna principal em superfície branca (`bg-surface`) colada ao topo, direita e base */}
      <div
        ref={canvasRef}
        className="relative z-10 flex min-h-dvh min-w-0 flex-1 flex-col bg-surface lg:h-dvh lg:min-h-0 lg:scroll-pt-12 lg:overflow-y-auto"
      >
        <header
          className={cn(
            "sticky top-0 z-30 h-12 shrink-0 border-b bg-surface transition-colors duration-150 ease-[var(--ease-out)] motion-reduce:transition-none",
            scrolled ? "border-border shadow-xs" : "border-border/80",
          )}
        >
          <div className="mx-auto flex h-full w-full max-w-360 items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex min-w-0 items-center gap-2 lg:hidden">
                <MobileNav badges={badges} followed={followed} nextAuction={nextAuction} />
                <Brand href="/dashboard" hideLabelOnNarrow />
              </div>
              <Suspense fallback={null}>
                <HeaderRouteContext />
              </Suspense>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCommandOpen(true)}
                aria-label={isMac ? "Ir para tela ou buscar (⌘K)" : "Ir para tela ou buscar (Ctrl+K)"}
                aria-keyshortcuts="Control+K Meta+K"
                className="size-10 text-muted hover:text-foreground sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5 lg:hidden pointer-coarse:h-11 pointer-coarse:min-w-11"
              >
                <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
                <span className="hidden text-label font-normal sm:inline">Buscar</span>
              </Button>
              {notifications}
              {sidebarAccount ? <div className="lg:hidden">{account}</div> : account}
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

      <Suspense fallback={null}>
        <ResetCanvasScrollOnNavigate canvasRef={canvasRef} />
      </Suspense>
      {commandItems}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <GlobalGuideDialog />
    </div>
  );
}
