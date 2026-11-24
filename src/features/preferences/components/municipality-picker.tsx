"use client";

import { MapPin, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button, Field, FieldDescription, FieldError, FieldLabel, Spinner } from "@/components/ui";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { cn } from "@/lib/utils";

import { searchMunicipalitiesAction } from "../actions";
import type { MunicipalityOption } from "../types";

type MunicipalityPickerProps = {
  initialIbgeCode: number | null;
  initialLabel: string | null;
  error?: string;
};

export function MunicipalityPicker({ initialIbgeCode, initialLabel, error }: MunicipalityPickerProps) {
  const inputId = useId();
  const listboxId = useId();
  const messageId = `${inputId}-message`;
  const [selected, setSelected] = useState<{ ibgeCode: number; label: string } | null>(
    initialIbgeCode !== null && initialLabel ? { ibgeCode: initialIbgeCode, label: initialLabel } : null,
  );
  const [query, setQuery] = useState(initialLabel ?? "");
  const [results, setResults] = useState<MunicipalityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (selected && next !== selected.label) {
      setSelected(null);
    }
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = next.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setOpen(true);
    const seq = ++requestSeqRef.current;
    timerRef.current = setTimeout(() => {
      void searchMunicipalitiesAction(trimmed)
        .then((items) => {
          if (requestSeqRef.current !== seq) return;
          setResults(items);
          setLoading(false);
        })
        .catch(() => {
          if (requestSeqRef.current !== seq) return;
          setResults([]);
          setLoading(false);
        });
    }, 220);
  }

  function handleSelect(option: MunicipalityOption) {
    setSelected({ ibgeCode: option.ibgeCode, label: option.label });
    setQuery(option.label);
    setResults([]);
    setOpen(false);
  }

  function handleClear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSelected(null);
    setQuery("");
    setResults([]);
    setOpen(false);
    setLoading(false);
  }

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>Município base (IBGE)</FieldLabel>
      <input type="hidden" name="municipalityIbgeCode" value={selected ? String(selected.ibgeCode) : ""} />
      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={messageId}
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder={`Padrão: ${DEFAULT_REGION.label} (digite cidade ou cidade/UF)`}
          className={cn(
            "h-10 w-full rounded-md border border-control-border bg-surface pr-9 pl-9 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)] outline-none placeholder:text-placeholder focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-9 sm:text-body",
            error && "border-error focus:border-error focus:ring-error/20",
          )}
        />
        {loading ? (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">
            <Spinner className="size-4" />
          </span>
        ) : query.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Limpar município e usar o padrão"
            onClick={handleClear}
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Municípios encontrados"
            className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-md"
          >
            {loading ? (
              <li className="px-2.5 py-2 text-caption text-muted">Buscando municípios…</li>
            ) : results.length === 0 ? (
              <li className="px-2.5 py-2 text-caption text-muted">
                Nenhum município encontrado. Tente o nome sem abreviações (ex.: Campinas/SP).
              </li>
            ) : (
              results.map((option) => (
                <li
                  key={option.ibgeCode}
                  role="option"
                  aria-selected={selected?.ibgeCode === option.ibgeCode}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-body text-foreground-secondary hover:bg-primary-subtle hover:text-foreground",
                    selected?.ibgeCode === option.ibgeCode && "bg-primary-subtle font-medium text-foreground",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  <span className="shrink-0 font-mono text-caption text-muted">IBGE {option.ibgeCode}</span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {error ? (
        <FieldError id={messageId}>{error}</FieldError>
      ) : (
        <FieldDescription id={messageId}>
          {selected
            ? `Selecionado: ${selected.label} (IBGE ${selected.ibgeCode}). Deixe vazio para voltar a ${DEFAULT_REGION.label}.`
            : `Usando o padrão do sistema (${DEFAULT_REGION.label}).`}
        </FieldDescription>
      )}
    </Field>
  );
}
