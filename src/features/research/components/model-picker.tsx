"use client";

import { History, Search, X } from "lucide-react";
import { Fragment, type KeyboardEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

import { salesLabel } from "../labels";
import {
  recentModelsServerSnapshot,
  recentModelsSnapshot,
  rememberModel,
  subscribeRecentModels,
} from "../recent-models";
import { matchModels } from "../search";
import type { ResearchModelOption } from "../types";

type ModelPickerProps = {
  /** Nome do modelo escolhido, ou `null` para todos. */
  value: string | null;
  options: readonly ResearchModelOption[];
  onChange: (option: ResearchModelOption | null) => void;
  className?: string;
  /** Nome do campo para leitores de tela. */
  label?: string;
  placeholder?: string;
  /** A tecla `/` foca este campo (só um por página). */
  shortcut?: boolean;
  /** Rótulo do "×" que tira o modelo escolhido. */
  clearLabel?: string;
};

/** Mais sugestões que isso só atrapalham a lista; cabem os recentes e os mais vendidos. */
const SUGGESTIONS = 8;

/** A tecla `/` vale em qualquer lugar, menos onde a pessoa está digitando. */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/**
 * Busca de modelo da Pesquisa (DESIGN.md §15.8): combobox que só aplica um modelo da lista, com as vendas de cada um.
 * Com o campo vazio, sugere os modelos pesquisados por último e depois os mais vendidos. Setas escolhem, Enter aplica o
 * destacado (ou o primeiro), Escape fecha e devolve o texto do modelo atual; `/` foca o campo.
 */
export function ModelPicker({
  value,
  options,
  onChange,
  className,
  label = "Modelo",
  placeholder = "Todos os modelos",
  shortcut = true,
  clearLabel = "Ver todos os modelos",
}: ModelPickerProps) {
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const skipNextFocusOpenRef = useRef(false);
  const recent = useSyncExternalStore(subscribeRecentModels, recentModelsSnapshot, recentModelsServerSnapshot);
  const [text, setText] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // A URL pode mudar por outro caminho (ranking, "Limpar", voltar): o campo acompanha.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value ?? "");
  }

  useEffect(() => {
    if (!shortcut) return;
    function focusOnSlash(event: globalThis.KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", focusOnSlash);
    return () => document.removeEventListener("keydown", focusOnSlash);
  }, [shortcut]);

  const typed = text === value ? "" : text;
  // Sem texto, os recentes vêm antes (com as vendas de hoje) e os mais vendidos completam a lista.
  const recentOptions =
    typed.trim() === ""
      ? recent.flatMap((item) => options.find((o) => o.brand === item.brand && o.model === item.model) ?? [])
      : [];
  const isRecent = (option: ResearchModelOption) => recentOptions.includes(option);
  const matches = open
    ? [...recentOptions, ...matchModels(options, typed, SUGGESTIONS).filter((option) => !isRecent(option))].slice(
        0,
        SUGGESTIONS,
      )
    : [];
  const noMatches = open && typed.trim() !== "" && matches.length === 0;
  const expanded = matches.length > 0 || noMatches;

  function dismiss() {
    setOpen(false);
    setActive(-1);
  }

  function reset() {
    setOpen(false);
    setActive(-1);
    setText(value ?? "");
  }

  function choose(option: ResearchModelOption) {
    setOpen(false);
    setActive(-1);
    setText(option.label);
    rememberModel({ brand: option.brand, model: option.model });
    onChange(option);
  }

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
      } else if (matches.length > 0) {
        setActive((index) => (index + 1) % matches.length);
      }
    } else if (event.key === "ArrowUp" && matches.length > 0) {
      event.preventDefault();
      setActive((index) => (index <= 0 ? matches.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = matches[active] ?? matches[0];
      if (option) choose(option);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      reset();
    }
  }

  return (
    <div className={cn("relative grid min-w-0 gap-2", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={matches.length > 0 && active >= 0 ? `${listId}-${active}` : undefined}
          aria-keyshortcuts={shortcut ? "/" : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={(event) => {
            if (value !== null && text === value) event.target.select();
            if (skipNextFocusOpenRef.current) {
              skipNextFocusOpenRef.current = false;
              return;
            }
            setOpen(true);
          }}
          onBlur={dismiss}
          className="h-10 w-full rounded-md border border-control-border bg-surface pr-10 pl-9 text-base text-foreground transition-[border-color,box-shadow] duration-120 outline-none placeholder:text-placeholder focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-body"
        />
        {value || text !== "" || !shortcut ? null : (
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-sm border border-border px-1.5 text-caption text-muted md:block"
          >
            /
          </kbd>
        )}
        {value || text !== "" ? (
          <button
            type="button"
            aria-label={value ? clearLabel : "Limpar busca"}
            onClick={() => {
              setText("");
              setOpen(false);
              setActive(-1);
              if (value !== null) onChange(null);
              skipNextFocusOpenRef.current = true;
              inputRef.current?.focus();
            }}
            className="absolute top-0 right-0 flex size-10 items-center justify-center rounded-md text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {noMatches ? `Nenhum modelo encontrado para ${typed.trim()}.` : ""}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label="Modelos"
        hidden={!expanded}
        className="absolute top-full right-0 left-0 z-40 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-1 shadow-md"
      >
        {noMatches ? (
          <li role="presentation" className="px-2.5 py-2 text-caption text-muted">
            Nenhum modelo encontrado para &ldquo;{typed.trim()}&rdquo;.
          </li>
        ) : (
          matches.map((option, index) => {
            const showRecentHeader = typed.trim() === "" && index === 0 && isRecent(option);
            const showPopularHeader =
              typed.trim() === "" &&
              !isRecent(option) &&
              (index === 0 || (index > 0 && isRecent(matches[index - 1] ?? option)));
            return (
              <Fragment key={`${option.brand}|${option.model}`}>
                {showRecentHeader ? (
                  <li role="presentation" className="px-2 pt-1.5 pb-1 text-caption font-medium text-muted">
                    Buscados por último
                  </li>
                ) : null}
                {showPopularHeader && recentOptions.length > 0 ? (
                  <li
                    role="presentation"
                    className="mt-1 border-t border-border px-2 pt-2 pb-1 text-caption font-medium text-muted"
                  >
                    Mais vendidos
                  </li>
                ) : null}
                <li
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // mousedown: escolhe antes de o campo perder o foco (e fechar a lista).
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-body hover:bg-surface-subtle",
                    index === active ? "bg-surface-subtle text-foreground" : "text-foreground-secondary",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {isRecent(option) ? (
                      <>
                        <History aria-hidden="true" className="size-4 shrink-0 text-muted" />
                        <span className="sr-only">Recente: </span>
                      </>
                    ) : null}
                    <span className="truncate">{option.label}</span>
                  </span>
                  <span className="text-caption text-muted tabular-nums">{salesLabel(option.sales)}</span>
                </li>
              </Fragment>
            );
          })
        )}
      </ul>
    </div>
  );
}
