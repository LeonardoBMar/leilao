"use client";

import {
  BellRing,
  Calculator,
  Car,
  ChartColumn,
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
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useSyncExternalStore } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

import { matchesCommandQuery, normalizeCommandText } from "./command-palette-search";
import { getCommandItemsServerSnapshot, getCommandItemsSnapshot, subscribeCommandItems } from "./command-palette-store";

type CommandDestination = {
  href: Route;
  label: string;
  meta?: string;
  group: "Navegação" | "Mercado" | "Ações" | "Sistema" | "Acompanhando" | "Buscar";
  keywords: string;
  icon: LucideIcon;
};

const DESTINATIONS: readonly CommandDestination[] = [
  { href: "/dashboard", label: "Início", group: "Navegação", keywords: "dashboard home resumo", icon: House },
  { href: "/leiloes", label: "Leilões do catálogo", group: "Navegação", keywords: "catalogo eventos", icon: Gavel },
  {
    href: "/leiloes/veiculos",
    label: "Todos os veículos",
    group: "Navegação",
    keywords: "anuncios carros motos buscar",
    icon: Car,
  },
  {
    href: "/minhas-analises",
    label: "Minhas análises",
    group: "Navegação",
    keywords: "lotes salvos limites",
    icon: Calculator,
  },
  { href: "/monitores", label: "Monitores", group: "Navegação", keywords: "buscas salvas radar", icon: Radar },
  { href: "/alertas", label: "Alertas", group: "Navegação", keywords: "notificacoes novos", icon: BellRing },
  {
    href: "/mercado",
    label: "Mercado — Avaliar modelo",
    group: "Mercado",
    keywords: "fipe faixa arremate preco provavel",
    icon: ChartColumn,
  },
  {
    href: "/mercado/panorama",
    label: "Mercado — Panorama",
    group: "Mercado",
    keywords: "mapa brasil ranking estados",
    icon: Compass,
  },
  {
    href: "/mercado/calibracao",
    label: "Mercado — Calibração",
    group: "Mercado",
    keywords: "backtest acertos historico",
    icon: Scale,
  },
  {
    href: "/minhas-analises?acompanhados=1&resultado=sem" as Route,
    label: "Lotes acompanhados ativos",
    group: "Ações",
    keywords: "acompanhando seguidos favoritos",
    icon: Eye,
  },
  {
    href: "/minhas-analises?analise=rascunho" as Route,
    label: "Rascunhos de análise em aberto",
    group: "Ações",
    keywords: "rascunho pendentes fixar",
    icon: FilePen,
  },
  {
    href: "/minhas-analises/leiloes/novo",
    label: "Cadastrar leilão manual",
    group: "Ações",
    keywords: "novo criar adicionar",
    icon: Plus,
  },
  {
    href: "/sistema",
    label: "Sistema — Saúde da coleta",
    group: "Sistema",
    keywords: "coletor fontes erros pausar status",
    icon: Radar,
  },
  {
    href: "/sistema/fipe",
    label: "Sistema — Correções FIPE",
    group: "Sistema",
    keywords: "fipe casamento tabela manual",
    icon: Database,
  },
];

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Paleta de salto rápido (`⌘K` / `Ctrl+K`).
 * Sem animação de entrada/saída (emil-design-eng: ações de teclado frequentes devem ser instantâneas).
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const quickItems = useSyncExternalStore(
    subscribeCommandItems,
    getCommandItemsSnapshot,
    getCommandItemsServerSnapshot,
  );

  const trimmedQuery = query.trim();
  const normalized = normalizeCommandText(trimmedQuery);
  const filteredDestinations = normalized
    ? DESTINATIONS.filter((item) => matchesCommandQuery([item.label, item.keywords, item.group], normalized))
    : DESTINATIONS;

  const followedDestinations: readonly CommandDestination[] = quickItems.map((item) => ({
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
    : followedDestinations.slice(0, 5);

  const searchActions: readonly CommandDestination[] =
    normalized.length >= 2
      ? [
          {
            href: `/leiloes/veiculos?busca=${encodeURIComponent(trimmedQuery)}` as Route,
            label: `Buscar “${trimmedQuery}” nos veículos do catálogo`,
            group: "Buscar",
            keywords: "",
            icon: Car,
          },
          {
            href: `/minhas-analises?busca=${encodeURIComponent(trimmedQuery)}` as Route,
            label: `Buscar “${trimmedQuery}” em Minhas análises`,
            group: "Buscar",
            keywords: "",
            icon: Calculator,
          },
        ]
      : [];

  const items = [...filteredDestinations, ...filteredFollowed, ...searchActions];
  const activeIndex = items.length > 0 ? Math.min(selectedIndex, items.length - 1) : -1;
  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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

  function navigateTo(href: Route) {
    handleOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        className="top-[18%] max-w-132 translate-y-0 gap-0 overflow-hidden p-0 transition-none duration-0"
      >
        <DialogTitle className="sr-only">Navegação rápida</DialogTitle>
        <DialogDescription className="sr-only">
          Digite para filtrar telas do Leilão Tracker ou buscar um veículo ou lote, e pressione Enter para abrir.
        </DialogDescription>
        <div className="flex items-center gap-2.5 border-b border-border px-3.5">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted" />
          <input
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
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
              } else if (event.key === "Enter" && activeIndex >= 0) {
                event.preventDefault();
                const item = items[activeIndex];
                if (item) navigateTo(item.href);
              }
            }}
            placeholder="Ir para uma tela ou buscar veículo/lote…"
            aria-label="Ir para uma tela ou buscar veículo ou lote"
            className="h-11 w-full bg-transparent text-base text-foreground outline-none placeholder:text-placeholder sm:text-body"
          />
          <kbd className="hidden rounded-sm border border-border-strong bg-background px-1.5 py-0.5 font-mono text-caption text-muted sm:inline-block">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-body text-muted">Nenhum destino encontrado para “{query}”.</p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Destinos" className="grid gap-0.5">
              {items.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === activeIndex;
                return (
                  <li
                    key={item.href}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => navigateTo(item.href)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-body select-none",
                      isSelected ? "bg-primary-subtle font-medium text-foreground" : "text-foreground-secondary",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className={cn("size-4 shrink-0", isSelected ? "text-foreground" : "text-muted-subtle")}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span>{item.label}</span>
                      {item.meta ? <span className="ml-2 text-caption font-normal text-muted">{item.meta}</span> : null}
                    </span>
                    <span className="shrink-0 text-caption text-muted">{item.group}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
