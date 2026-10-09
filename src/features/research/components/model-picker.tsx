"use client";

import { Search, X } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";

import { cn } from "@/lib/utils";

import { salesLabel } from "../labels";
import { matchModels } from "../search";
import type { ResearchModelOption } from "../types";

type ModelPickerProps = {
  /** Nome do modelo escolhido, ou `null` para todos. */
  value: string | null;
  options: readonly ResearchModelOption[];
  onChange: (option: ResearchModelOption | null) => void;
  className?: string;
};

/**
 * Busca de modelo da Pesquisa (DESIGN.md §15.8): combobox que só aplica um modelo da lista, com as vendas de cada um.
 * Setas escolhem, Enter aplica o destacado (ou o primeiro), Escape fecha e devolve o texto do modelo atual.
 */
export function ModelPicker({ value, options, onChange, className }: ModelPickerProps) {
  const inputId = useId();
  const listId = useId();
  const [text, setText] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // A URL pode mudar por outro caminho (ranking, "Limpar", voltar): o campo acompanha.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value ?? "");
  }

  const matches = open ? matchModels(options, text === value ? "" : text) : [];
  const expanded = matches.length > 0;

  function close() {
    setOpen(false);
    setActive(-1);
    setText(value ?? "");
  }

  function choose(option: ResearchModelOption) {
    setOpen(false);
    setActive(-1);
    setText(option.label);
    onChange(option);
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
      const option = matches[active] ?? matches[0];
      if (option) choose(option);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className={cn("relative grid min-w-0 gap-2", className)}>
      <label htmlFor={inputId} className="sr-only">
        Modelo
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
          placeholder="Todos os modelos"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={(event) => {
            event.target.select();
            setOpen(true);
          }}
          onBlur={close}
          className="h-10 w-full rounded-md border border-control-border bg-surface pr-10 pl-9 text-body text-foreground transition-[border-color,box-shadow] duration-120 outline-none placeholder:text-placeholder focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {value ? (
          <button
            type="button"
            aria-label="Ver todos os modelos"
            onClick={() => {
              setText("");
              onChange(null);
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
        aria-label="Modelos"
        hidden={!expanded}
        className="absolute top-full right-0 left-0 z-40 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-1 shadow-md"
      >
        {matches.map((option, index) => (
          <li
            key={`${option.brand}|${option.model}`}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // mousedown: escolhe antes de o campo perder o foco (e fechar a lista).
            onMouseDown={(event) => {
              event.preventDefault();
              choose(option);
            }}
            className={cn(
              "flex min-h-10 cursor-default items-center justify-between gap-3 rounded-md px-2 text-body",
              index === active ? "bg-surface-subtle text-foreground" : "text-foreground-secondary",
            )}
          >
            <span className="truncate">{option.label}</span>
            <span className="text-caption text-muted tabular-nums">{salesLabel(option.sales)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
