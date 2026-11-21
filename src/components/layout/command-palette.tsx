"use client";

import {
  BellRing,
  Calculator,
  Car,
  ChartColumn,
  Compass,
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
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

type CommandDestination = {
  href: Route;
  label: string;
  group: "Navegação" | "Mercado" | "Ações";
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
    href: "/minhas-analises/leiloes/novo",
    label: "Cadastrar leilão manual",
    group: "Ações",
    keywords: "novo criar adicionar",
    icon: Plus,
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
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? DESTINATIONS.filter(
        (item) =>
          item.label.toLowerCase().includes(normalized) ||
          item.keywords.includes(normalized) ||
          item.group.toLowerCase().includes(normalized),
      )
    : DESTINATIONS;

  const activeIndex = filtered.length > 0 ? Math.min(selectedIndex, filtered.length - 1) : -1;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
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
      <DialogContent className="top-[18%] max-w-132 translate-y-0 gap-0 overflow-hidden p-0 transition-none duration-0 [&>button[aria-label='Fechar']]:hidden">
        <DialogTitle className="sr-only">Navegação rápida</DialogTitle>
        <DialogDescription className="sr-only">
          Digite para filtrar telas do Leilão Tracker e pressione Enter para abrir.
        </DialogDescription>
        <div className="flex items-center gap-2.5 border-b border-border px-3.5">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((current) => (filtered.length > 0 ? (current + 1) % filtered.length : 0));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((current) =>
                  filtered.length > 0 ? (current - 1 + filtered.length) % filtered.length : 0,
                );
              } else if (event.key === "Enter" && activeIndex >= 0) {
                event.preventDefault();
                const item = filtered[activeIndex];
                if (item) navigateTo(item.href);
              }
            }}
            placeholder="Ir para uma tela ou ação…"
            aria-label="Ir para uma tela ou ação"
            className="h-11 w-full bg-transparent text-base text-foreground outline-none placeholder:text-placeholder sm:text-body"
          />
          <kbd className="hidden rounded-sm border border-border-strong bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline-block">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-body text-muted">Nenhum destino encontrado para “{query}”.</p>
          ) : (
            <ul role="listbox" aria-label="Destinos" className="grid gap-0.5">
              {filtered.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === activeIndex;
                return (
                  <li key={item.href} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => navigateTo(item.href)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body outline-none",
                        isSelected ? "bg-primary-subtle font-medium text-foreground" : "text-foreground-secondary",
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className={cn("size-4 shrink-0", isSelected ? "text-foreground" : "text-muted-subtle")}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <span className="text-caption text-muted">{item.group}</span>
                    </button>
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
