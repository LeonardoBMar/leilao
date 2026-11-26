"use client";

import {
  BellRing,
  Calculator,
  Car,
  ChartColumn,
  CircleHelp,
  Clock,
  Compass,
  Database,
  Eye,
  FilePen,
  Gavel,
  House,
  type LucideIcon,
  Plus,
  Radar,
  Scale,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

import { getAdminRoleServerSnapshot, getAdminRoleSnapshot, subscribeAdminRole } from "./admin-role-store";
import { matchesCommandQuery, normalizeCommandText } from "./command-palette-search";
import { getCommandItemsServerSnapshot, getCommandItemsSnapshot, subscribeCommandItems } from "./command-palette-store";
import { setGuideDialogOpen } from "./guide-dialog-store";
import { useIsMac } from "./use-is-mac";

const RECENTS_STORAGE_KEY = "leilao.command-recents";
const MAX_RECENTS = 3;

type StoredRecent = { href: string; label: string; meta?: string };

const EMPTY_RECENTS: readonly StoredRecent[] = [];
const recentListeners = new Set<() => void>();
let cachedRecentsRaw: string | null = null;
let cachedRecentsParsed: readonly StoredRecent[] = EMPTY_RECENTS;

function subscribeRecents(listener: () => void) {
  recentListeners.add(listener);
  function onStorage(event: StorageEvent) {
    if (event.key === RECENTS_STORAGE_KEY || event.key === null) {
      listener();
    }
  }
  window.addEventListener("storage", onStorage);
  return () => {
    recentListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getRecentsSnapshot(): readonly StoredRecent[] {
  if (typeof window === "undefined") return EMPTY_RECENTS;
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    if (raw === cachedRecentsRaw) return cachedRecentsParsed;
    cachedRecentsRaw = raw;
    if (!raw) {
      cachedRecentsParsed = EMPTY_RECENTS;
      return cachedRecentsParsed;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedRecentsParsed = EMPTY_RECENTS;
      return cachedRecentsParsed;
    }
    cachedRecentsParsed = parsed
      .filter(
        (entry): entry is StoredRecent =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as StoredRecent).href === "string" &&
          (entry as StoredRecent).href.startsWith("/") &&
          typeof (entry as StoredRecent).label === "string",
      )
      .slice(0, MAX_RECENTS);
    return cachedRecentsParsed;
  } catch {
    return EMPTY_RECENTS;
  }
}

function getRecentsServerSnapshot(): readonly StoredRecent[] {
  return EMPTY_RECENTS;
}

function recordRecent(entry: StoredRecent) {
  try {
    const current = getRecentsSnapshot().filter((item) => item.href !== entry.href);
    const next = [entry, ...current].slice(0, MAX_RECENTS);
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(RECENTS_STORAGE_KEY, serialized);
    cachedRecentsRaw = serialized;
    cachedRecentsParsed = next;
  } catch {
    // Modo privado ou quota excedida: segue sem persistir.
  }
  for (const listener of recentListeners) {
    listener();
  }
}

type CommandDestination = {
  href?: Route;
  onSelect?: () => void;
  id: string;
  label: string;
  meta?: string;
  group: "Recentes" | "Navegação" | "Mercado" | "Ações" | "Sistema" | "Acompanhando" | "Buscar";
  keywords: string;
  icon: LucideIcon;
};

const DESTINATIONS: readonly CommandDestination[] = [
  {
    id: "/dashboard",
    href: "/dashboard",
    label: "Início",
    group: "Navegação",
    keywords: "dashboard home resumo",
    icon: House,
  },
  {
    id: "/leiloes",
    href: "/leiloes",
    label: "Leilões do catálogo",
    group: "Navegação",
    keywords: "catalogo eventos",
    icon: Gavel,
  },
  {
    id: "/leiloes/veiculos",
    href: "/leiloes/veiculos",
    label: "Todos os veículos",
    group: "Navegação",
    keywords: "anuncios carros motos buscar",
    icon: Car,
  },
  {
    id: "/minhas-analises",
    href: "/minhas-analises",
    label: "Minhas análises",
    group: "Navegação",
    keywords: "lotes salvos limites",
    icon: Calculator,
  },
  {
    id: "/monitores",
    href: "/monitores",
    label: "Monitores",
    group: "Navegação",
    keywords: "buscas salvas radar",
    icon: Radar,
  },
  {
    id: "/alertas",
    href: "/alertas",
    label: "Alertas",
    group: "Navegação",
    keywords: "notificacoes novos",
    icon: BellRing,
  },
  {
    id: "/mercado",
    href: "/mercado",
    label: "Mercado — Avaliar modelo",
    group: "Navegação",
    keywords: "fipe faixa arremate preco provavel mercado",
    icon: ChartColumn,
  },
  {
    id: "/mercado/panorama",
    href: "/mercado/panorama",
    label: "Mercado — Panorama",
    group: "Mercado",
    keywords: "mapa brasil ranking estados",
    icon: Compass,
  },
  {
    id: "/mercado/calibracao",
    href: "/mercado/calibracao",
    label: "Mercado — Calibração",
    group: "Mercado",
    keywords: "backtest acertos historico",
    icon: Scale,
  },
  {
    id: "action:followed",
    href: "/minhas-analises?acompanhados=1&resultado=sem" as Route,
    label: "Lotes acompanhados ativos",
    group: "Ações",
    keywords: "acompanhando seguidos favoritos",
    icon: Eye,
  },
  {
    id: "action:drafts",
    href: "/minhas-analises?analise=rascunho" as Route,
    label: "Rascunhos de análise em aberto",
    group: "Ações",
    keywords: "rascunho pendentes fixar",
    icon: FilePen,
  },
  {
    id: "/minhas-analises/leiloes/novo",
    href: "/minhas-analises/leiloes/novo",
    label: "Cadastrar leilão manual",
    group: "Ações",
    keywords: "novo criar adicionar",
    icon: Plus,
  },
  {
    id: "action:guide",
    onSelect: () => setGuideDialogOpen(true),
    label: "Guia rápido e atalhos",
    group: "Ações",
    keywords: "ajuda guia atalhos glossario como ler preco provavel limite calibracao",
    icon: CircleHelp,
  },
  {
    id: "/sistema",
    href: "/sistema",
    label: "Sistema — Saúde da coleta",
    group: "Sistema",
    keywords: "coletor fontes erros pausar status",
    icon: Radar,
  },
  {
    id: "/sistema/fipe",
    href: "/sistema/fipe",
    label: "Sistema — Correções FIPE",
    group: "Sistema",
    keywords: "fipe casamento tabela manual",
    icon: Database,
  },
  {
    id: "/sistema/preferencias",
    href: "/sistema/preferencias",
    label: "Sistema — Preferências",
    group: "Sistema",
    keywords: "preferencias regiao cidade raio margem guincho premissas padrao",
    icon: SlidersHorizontal,
  },
];

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Registra navegações por links comuns (sidebar/dashboard) no histórico de Recentes da paleta. */
function RecordPathnameRecent() {
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === prevPathname.current) return;
    prevPathname.current = pathname;
    const match = DESTINATIONS.find((entry) => entry.href === pathname);
    if (match && match.href) {
      recordRecent({ href: match.href, label: match.label, meta: match.meta });
    }
  }, [pathname]);

  return null;
}

/**
 * Paleta de salto rápido (`⌘K` / `Ctrl+K`).
 * Sem animação de entrada/saída (emil-design-eng: ações de teclado frequentes devem ser instantâneas).
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = useIsMac();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const recents = useSyncExternalStore(subscribeRecents, getRecentsSnapshot, getRecentsServerSnapshot);
  const isAdmin = useSyncExternalStore(subscribeAdminRole, getAdminRoleSnapshot, getAdminRoleServerSnapshot);
  const quickItems = useSyncExternalStore(
    subscribeCommandItems,
    getCommandItemsSnapshot,
    getCommandItemsServerSnapshot,
  );

  const visibleDestinations = isAdmin
    ? DESTINATIONS
    : DESTINATIONS.flatMap((item) => {
        if (item.href === "/sistema" || item.href === "/sistema/fipe") return [];
        if (item.href === "/sistema/preferencias") {
          return [{ ...item, label: "Preferências", group: "Navegação" as const }];
        }
        return [item];
      });

  const trimmedQuery = query.trim();
  const normalized = normalizeCommandText(trimmedQuery);

  const recentDestinations: readonly CommandDestination[] = !normalized
    ? recents
        .filter((item) => isAdmin || !item.href.startsWith("/sistema") || item.href === "/sistema/preferencias")
        .map((item) => ({
          id: `recent:${item.href}`,
          href: item.href as Route,
          label: item.label,
          meta: item.meta,
          group: "Recentes",
          keywords: "",
          icon: Clock,
        }))
    : [];
  const recentHrefs = new Set(recentDestinations.map((item) => item.href).filter(Boolean));

  // Sem consulta digitada, exibe apenas destinos principais e ações (sub-rotas de Mercado/Sistema entram ao digitar).
  const defaultDestinations = visibleDestinations.filter(
    (item) => (item.group === "Navegação" || item.group === "Ações") && (!item.href || !recentHrefs.has(item.href)),
  );
  const filteredDestinations = normalized
    ? visibleDestinations.filter((item) => matchesCommandQuery([item.label, item.keywords, item.group], normalized))
    : defaultDestinations;

  const followedDestinations: readonly CommandDestination[] = quickItems.map((item) => ({
    id: `followed:${item.href}`,
    href: item.href,
    label: item.label,
    meta: item.meta,
    group: "Acompanhando",
    keywords: item.keywords ?? "",
    icon: Eye,
  }));
  const filteredFollowed = normalized
    ? followedDestinations.filter((item) =>
        matchesCommandQuery([item.label, item.meta, item.keywords, item.group], normalized),
      )
    : followedDestinations.filter((item) => !item.href || !recentHrefs.has(item.href)).slice(0, 4);

  const searchActions: readonly CommandDestination[] =
    normalized.length >= 2
      ? [
          {
            id: `search:catalog:${trimmedQuery}`,
            href: `/leiloes/veiculos?busca=${encodeURIComponent(trimmedQuery)}` as Route,
            label: `Buscar “${trimmedQuery}” nos veículos do catálogo`,
            group: "Buscar",
            keywords: "",
            icon: Car,
          },
          {
            id: `search:analyses:${trimmedQuery}`,
            href: `/minhas-analises?busca=${encodeURIComponent(trimmedQuery)}` as Route,
            label: `Buscar “${trimmedQuery}” em Minhas análises`,
            group: "Buscar",
            keywords: "",
            icon: Calculator,
          },
        ]
      : [];

  const items = [...recentDestinations, ...filteredFollowed, ...filteredDestinations, ...searchActions];
  const activeIndex = items.length > 0 ? Math.min(selectedIndex, items.length - 1) : -1;
  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const groupedItems: { group: CommandDestination["group"]; entries: { item: CommandDestination; index: number }[] }[] =
    [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item) continue;
    const existing = groupedItems.find((entry) => entry.group === item.group);
    if (existing) {
      existing.entries.push({ item, index });
    } else {
      groupedItems.push({ group: item.group, entries: [{ item, index }] });
    }
  }

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeOptionId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.shiftKey) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          setQuery("");
          setSelectedIndex(0);
        }
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setSelectedIndex(0);
    }
    onOpenChange(next);
  }

  function activateDestination(destination: CommandDestination) {
    handleOpenChange(false);
    if (destination.onSelect) {
      destination.onSelect();
      return;
    }
    if (destination.href) {
      if (destination.group !== "Buscar") {
        recordRecent({ href: destination.href, label: destination.label, meta: destination.meta });
      }
      router.push(destination.href);
    }
  }

  return (
    <>
      <Suspense fallback={null}>
        <RecordPathnameRecent />
      </Suspense>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          hideClose
          className="top-[8%] max-w-132 translate-y-0 gap-0 overflow-hidden p-0 transition-none duration-0 sm:top-[18%]"
        >
          <DialogTitle className="sr-only">Navegação rápida</DialogTitle>
          <DialogDescription className="sr-only">
            Digite para filtrar telas do Leilão Tracker ou buscar um veículo ou lote, e pressione Enter para abrir.
          </DialogDescription>
          <div className="flex items-center gap-2 border-b border-border px-3.5">
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls={items.length > 0 ? listboxId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelectedIndex((current) => (items.length > 0 ? (current + 1) % items.length : 0));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelectedIndex((current) => (items.length > 0 ? (current - 1 + items.length) % items.length : 0));
                } else if (event.key === "Home" && items.length > 0) {
                  event.preventDefault();
                  setSelectedIndex(0);
                } else if (event.key === "End" && items.length > 0) {
                  event.preventDefault();
                  setSelectedIndex(items.length - 1);
                } else if (event.key === "Enter" && activeIndex >= 0) {
                  event.preventDefault();
                  const item = items[activeIndex];
                  if (item) activateDestination(item);
                }
              }}
              placeholder="Ir para uma tela ou digitar para buscar veículo/lote…"
              aria-label="Ir para uma tela ou buscar veículo ou lote"
              className="h-11 w-full bg-transparent text-base text-foreground outline-none placeholder:text-placeholder sm:text-body"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                aria-label="Limpar busca"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors outline-none hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent pointer-coarse:size-10"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
            <DialogClose
              aria-label="Fechar busca"
              className="hidden rounded-sm border border-border-strong bg-background px-1.5 py-0.5 font-mono text-caption text-muted transition-colors outline-none hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent sm:inline-flex sm:items-center"
            >
              ESC
            </DialogClose>
            <DialogClose
              aria-label="Fechar busca"
              className="-mr-1.5 flex size-10 shrink-0 items-center justify-center rounded-md text-muted transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97] sm:hidden"
            >
              <X aria-hidden="true" className="size-4.5" />
            </DialogClose>
          </div>

          <div className="max-h-[min(20rem,50dvh)] overflow-y-auto overscroll-contain p-1.5">
            {items.length === 0 ? (
              <p role="status" className="px-3 py-8 text-center text-body text-muted">
                Nenhum destino encontrado para “{query}”.
              </p>
            ) : (
              <div id={listboxId} role="listbox" aria-label="Destinos" className="grid gap-2.5">
                {groupedItems.map(({ group, entries }, groupIndex) => {
                  const headingId = `${listboxId}-group-${groupIndex}`;
                  return (
                    <div key={group} role="group" aria-labelledby={headingId} className="grid gap-0.5">
                      <p
                        id={headingId}
                        className="px-2.5 pt-1 pb-0.5 font-mono text-overline font-medium text-muted uppercase"
                      >
                        {group}
                      </p>
                      {entries.map(({ item, index }) => {
                        const Icon = item.icon;
                        const isSelected = index === activeIndex;
                        return (
                          <div
                            key={item.id}
                            id={`${listboxId}-option-${index}`}
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setSelectedIndex(index)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => activateDestination(item)}
                            className={cn(
                              "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-body select-none pointer-coarse:min-h-11",
                              isSelected
                                ? "bg-primary-subtle font-medium text-foreground"
                                : "text-foreground-secondary",
                            )}
                          >
                            <Icon
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className={cn("size-4 shrink-0", isSelected ? "text-foreground" : "text-muted-subtle")}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              <span>{item.label}</span>
                              {item.meta ? (
                                <span className="ml-2 text-caption font-normal text-muted">{item.meta}</span>
                              ) : null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden items-center justify-between gap-3 border-t border-border bg-background px-3.5 py-2 text-caption text-muted sm:flex">
            <span className="flex items-center gap-3">
              <span>
                <kbd className="font-mono text-foreground-secondary">↑↓</kbd> navegar
              </span>
              <span>
                <kbd className="font-mono text-foreground-secondary">↵</kbd> abrir
              </span>
              <span>
                <kbd className="font-mono text-foreground-secondary">Esc</kbd> fechar
              </span>
            </span>
            <span>
              <kbd className="font-mono text-foreground-secondary">{isMac ? "⌘B" : "Ctrl+B"}</kbd> barra lateral
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
