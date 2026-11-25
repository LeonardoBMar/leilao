"use client";

import { MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";

import { Button, Field, FieldDescription, FieldError, FieldLabel, Spinner } from "@/components/ui";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { cn } from "@/lib/utils";

import type { MunicipalityOption } from "../types";

const municipalityResponseSchema = z.object({
  data: z.array(
    z.object({
      ibgeCode: z.number(),
      name: z.string(),
      state: z.string(),
      label: z.string(),
    }),
  ),
});

type MunicipalityPickerProps = {
  initialIbgeCode: number | null;
  initialLabel: string | null;
  error?: string;
};

export function MunicipalityPicker({ initialIbgeCode, initialLabel, error }: MunicipalityPickerProps) {
  const router = useRouter();
  const inputId = useId();
  const listboxId = useId();
  const messageId = `${inputId}-message`;
  const [selected, setSelected] = useState<{ ibgeCode: number; label: string } | null>(
    initialIbgeCode !== null && initialLabel ? { ibgeCode: initialIbgeCode, label: initialLabel } : null,
  );
  const [query, setQuery] = useState(initialLabel ?? "");
  const [results, setResults] = useState<MunicipalityOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleQueryChange(next: string) {
    setQuery(next);
    setSearchError(null);
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = next.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      requestSeqRef.current += 1;
      setResults([]);
      setActiveIndex(-1);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setOpen(true);
    setActiveIndex(-1);
    const seq = ++requestSeqRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    timerRef.current = setTimeout(() => {
      void fetch(`/api/v1/municipalities?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          if (response.status === 401) {
            router.replace("/login");
            return null;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return municipalityResponseSchema.parse(await response.json()).data;
        })
        .then((items) => {
          if (items === null || requestSeqRef.current !== seq) return;
          setResults(items);
          setActiveIndex(items.length > 0 ? 0 : -1);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted || requestSeqRef.current !== seq) return;
          setResults([]);
          setActiveIndex(-1);
          setSearchError("Não foi possível buscar municípios. Tente novamente.");
          setLoading(false);
        });
    }, 220);
  }

  function handleSelect(option: MunicipalityOption) {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setSelected({ ibgeCode: option.ibgeCode, label: option.label });
    setQuery(option.label);
    setResults([]);
    setActiveIndex(-1);
    setSearchError(null);
    setOpen(false);
  }

  function handleClear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    abortRef.current?.abort();
    requestSeqRef.current += 1;
    setSelected(null);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setSearchError(null);
    setOpen(false);
    setLoading(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (results.length === 0) return;
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((prev) => (prev + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(results.length - 1);
        return;
      }
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const chosen = activeIndex >= 0 ? results[activeIndex] : results[0];
      if (chosen) handleSelect(chosen);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      setQuery(selected?.label ?? "");
    }
  }

  const activeDescendantId =
    open && activeIndex >= 0 && results[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;

  const liveAnnouncement = !open
    ? ""
    : loading
      ? "Buscando municípios…"
      : searchError
        ? searchError
        : results.length === 0
          ? "Nenhum município encontrado."
          : `${results.length} ${results.length === 1 ? "município encontrado" : "municípios encontrados"}.`;

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
          aria-activedescendant={activeDescendantId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={messageId}
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => {
              setOpen(false);
              setActiveIndex(-1);
              setQuery(selected?.label ?? "");
            }, 150);
          }}
          placeholder={`Padrão: ${DEFAULT_REGION.label} (digite cidade ou cidade/UF)`}
          className={cn(
            "h-10 w-full rounded-md border border-control-border bg-surface pr-10 pl-9 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)] outline-none placeholder:text-placeholder focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-9 sm:text-body",
            error && "border-error focus:border-error focus:ring-error/20",
          )}
        />
        {loading ? (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">
            <Spinner className="size-4" />
          </span>
        ) : query.length > 0 || selected !== null ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Limpar município e usar o padrão"
            onClick={handleClear}
            className="absolute top-1/2 right-0 size-10 -translate-y-1/2 text-muted hover:text-foreground sm:size-9"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : null}

        <p role="status" aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </p>

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Municípios encontrados"
            className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface-elevated p-1 shadow-md"
          >
            {loading ? (
              <li className="px-3 py-2 text-caption text-muted">Buscando municípios…</li>
            ) : searchError ? (
              <li className="px-3 py-2 text-caption text-error">{searchError}</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-2 text-caption text-muted">
                Nenhum município encontrado. Tente o nome sem abreviações (ex.: Campinas/SP).
              </li>
            ) : (
              results.map((option, index) => {
                const isSelected = selected?.ibgeCode === option.ibgeCode;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={option.ibgeCode}
                    id={`${listboxId}-option-${index}`}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelect(option);
                    }}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-body text-foreground-secondary transition-colors",
                      (isActive || isSelected) && "bg-primary-subtle text-foreground",
                      isSelected && "font-medium",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    <span className="shrink-0 font-mono text-caption text-muted tabular-nums">
                      IBGE {option.ibgeCode}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
      {error ? (
        <FieldError id={messageId}>{error}</FieldError>
      ) : (
        <FieldDescription id={messageId}>
          {selected
            ? `Selecionado: ${selected.label} (IBGE ${selected.ibgeCode}). Limpe o campo para voltar a ${DEFAULT_REGION.label}.`
            : `Usando o padrão do sistema (${DEFAULT_REGION.label}).`}
        </FieldDescription>
      )}
    </Field>
  );
}
