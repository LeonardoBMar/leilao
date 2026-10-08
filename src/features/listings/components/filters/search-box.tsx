"use client";

import { Search, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { matchSuggestions, type SearchSuggestion } from "@/domain/listings/facets";
import { cn } from "@/lib/utils";

/** Espera depois da última tecla antes de buscar. */
const DEBOUNCE_MS = 400;

type SearchBoxProps = {
  value: string | null;
  onSearch: (value: string | null) => void;
  suggestions: readonly SearchSuggestion[];
  className?: string;
};

/**
 * Busca por marca, modelo ou versão (DESIGN.md §5.15). Aplica 400 ms depois da última tecla ou com Enter. Sugere
 * marca e modelo com a contagem no filtro atual (padrão combobox: setas escolhem, Enter aplica, Escape fecha).
 */
export function SearchBox({ value, onSearch, suggestions, className }: SearchBoxProps) {
  const inputId = useId();
  const listId = useId();
  const [text, setText] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Último valor enviado. Quando a URL muda por outro caminho (chip, "Limpar", voltar), o campo acompanha; quando
  // é a resposta à própria digitação, não (o usuário pode ter digitado mais enquanto a tela carregava).
  const [sent, setSent] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    if (value !== sent) {
      setSent(value);
      setText(value ?? "");
    }
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const matches = open ? matchSuggestions(suggestions, text) : [];
  const expanded = matches.length > 0;

  function submit(next: string) {
    if (timer.current) clearTimeout(timer.current);
    const normalized = next.trim() || null;
    if (normalized === sent) return;
    setSent(normalized);
    onSearch(normalized);
  }

  function change(next: string) {
    setText(next);
    setOpen(true);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => submit(next), DEBOUNCE_MS);
  }

  function choose(suggestion: SearchSuggestion) {
    setText(suggestion.label);
    setOpen(false);
    setActive(-1);
    submit(suggestion.label);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && expanded) {
      event.preventDefault();
      setActive((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp" && expanded) {
      event.preventDefault();
      setActive((index) => (index <= 0 ? matches.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = matches[active];
      if (suggestion) choose(suggestion);
      else {
        setOpen(false);
        submit(text);
      }
    } else if (event.key === "Escape" && expanded) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className={cn("relative grid min-w-0 gap-2", className)}>
      <label htmlFor={inputId} className="sr-only">
        Buscar por marca, modelo ou versão
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Buscar marca, modelo ou versão"
          value={text}
          onChange={(event) => change(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="h-10 w-full rounded-md border border-control-border bg-surface pr-10 pl-9 text-body text-foreground transition-[border-color,box-shadow] duration-120 outline-none placeholder:text-placeholder focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {text ? (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setText("");
              setOpen(false);
              submit("");
            }}
            className="absolute top-0 right-0 flex size-10 items-center justify-center rounded-md text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Sugestões"
        hidden={!expanded}
        className="absolute top-full right-0 left-0 z-40 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-1 shadow-md"
      >
        {matches.map((suggestion, index) => (
          <li
            key={suggestion.label}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // mousedown: escolhe antes de o campo perder o foco (e fechar a lista).
            onMouseDown={(event) => {
              event.preventDefault();
              choose(suggestion);
            }}
            className={cn(
              "flex min-h-10 cursor-default items-center justify-between gap-3 rounded-md px-2 text-body",
              index === active ? "bg-surface-subtle text-foreground" : "text-foreground-secondary",
            )}
          >
            <span className="truncate">{suggestion.label}</span>
            <span className="text-caption text-muted tabular-nums">
              {suggestion.count} {suggestion.count === 1 ? "lote" : "lotes"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
