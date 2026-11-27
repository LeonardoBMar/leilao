"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { normalizeCommandText } from "./command-palette-search";
import { useIsMac } from "./use-is-mac";

type GlossaryEntry = {
  term: string;
  description: string;
};

const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: "Lance atual vs. preço provável",
    description:
      "A barra compara o lance observado agora com seu limite fixado; o preço provável projeta onde o arremate costuma encerrar no histórico.",
  },
  {
    term: "Preço provável",
    description:
      "Mediana dos arremates comparáveis do mesmo modelo no catálogo, sempre acompanhada do tamanho da base (n).",
  },
  {
    term: "Limite estimado e premissas padrão",
    description:
      "Lance máximo calculado a partir das suas análises anteriores ou das premissas padrão de margem, guincho e custos configuradas em Preferências.",
  },
  {
    term: "Monitores e região-base",
    description:
      "Sua região-base define o raio padrão do catálogo; monitores são buscas salvas que avisam quando surgem novos lotes compatíveis.",
  },
  {
    term: "Fixar análise e versões (v1, v2)",
    description:
      "Análises fixadas antes do leilão ficam imutáveis para preservar sua disciplina; cada ajuste posterior gera uma nova versão.",
  },
  {
    term: "Resultados comparáveis e calibração",
    description:
      "Lotes com análise fixada antes do leilão e resultado registrado, usados para acompanhar a precisão dos seus limites.",
  },
];

type GlossaryContentProps = {
  onNavigate?: () => void;
  searchable?: boolean;
};

/**
 * Glossário único de conceitos financeiros e atalhos de teclado, reutilizado no popover do dashboard e no diálogo
 * global da conta/paleta de comandos para evitar divergência de conteúdo.
 */
export function GlossaryContent({ onNavigate, searchable = false }: GlossaryContentProps) {
  const isMac = useIsMac();
  const [filter, setFilter] = useState("");
  const normalized = normalizeCommandText(filter.trim());
  const shortcuts = [
    { key: isMac ? "⌘K" : "Ctrl+K", label: "busca rápida", keywords: "atalho busca comando palette k" },
    { key: isMac ? "⌘B" : "Ctrl+B", label: "barra lateral", keywords: "atalho sidebar recolher expandir b" },
    { key: "?", label: "guia rápido", keywords: "atalho ajuda glossario duvida" },
  ] as const;
  const visibleEntries = normalized
    ? GLOSSARY_ENTRIES.filter((entry) =>
        normalizeCommandText(`${entry.term} ${entry.description}`).includes(normalized),
      )
    : GLOSSARY_ENTRIES;
  const visibleShortcuts = normalized
    ? shortcuts.filter((shortcut) =>
        normalizeCommandText(`${shortcut.key} ${shortcut.label} ${shortcut.keywords}`).includes(normalized),
      )
    : shortcuts;
  const hasAnyMatch = visibleEntries.length > 0 || visibleShortcuts.length > 0;

  return (
    <>
      {searchable ? (
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filtrar termo ou atalho…"
            aria-label="Filtrar termo ou atalho do glossário"
            className="h-10 w-full rounded-md border border-control-border bg-surface pr-3 pl-9 text-base text-foreground transition-colors outline-none placeholder:text-placeholder focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 sm:text-body"
          />
        </div>
      ) : null}

      {!hasAnyMatch ? (
        <p role="status" className="py-4 text-center text-caption text-muted">
          Nenhum termo ou atalho encontrado para “{filter}”.
        </p>
      ) : visibleEntries.length > 0 ? (
        <dl className="grid gap-3 text-caption">
          {visibleEntries.map((entry) => (
            <div key={entry.term} className="grid gap-0.5">
              <dt className="font-semibold text-foreground">{entry.term}</dt>
              <dd className="text-foreground-secondary">{entry.description}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {visibleShortcuts.length > 0 || !normalized ? (
        <div className="grid gap-2 border-t border-border pt-3 text-caption">
          <p className="font-mono text-overline font-medium text-muted uppercase">Atalhos de teclado</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-foreground-secondary">
            {visibleShortcuts.map((shortcut) => (
              <span key={shortcut.label}>
                <kbd className="rounded-sm border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-caption text-foreground">
                  {shortcut.key}
                </kbd>{" "}
                {shortcut.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {hasAnyMatch ? (
        <div className="border-t border-border pt-3 text-caption">
          <Link
            href="/sistema/preferencias"
            onClick={onNavigate}
            className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent pointer-coarse:min-h-11"
          >
            <SlidersHorizontal aria-hidden="true" className="size-3.5" />
            Ajustar premissas padrão e região-base
          </Link>
        </div>
      ) : null}
    </>
  );
}
