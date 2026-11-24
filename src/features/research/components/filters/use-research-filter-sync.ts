"use client";

import { type Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef } from "react";

import { pickSharedQuery, rememberMarketContext } from "../../tab-context";
import { useResearchTransition } from "../research-shell";

type UseResearchFilterSyncOptions<T> = {
  params: Readonly<Record<string, string>>;
  parse: (params: Readonly<Record<string, string>>) => T;
  toHref: (filters: T) => Route;
  normalize?: (next: T) => T;
  rememberEvaluate?: boolean;
};

/**
 * Sincroniza filtros do Mercado com a URL, mantém estado otimista durante a transição e lembra o contexto entre abas.
 */
export function useResearchFilterSync<T>({
  params,
  parse,
  toHref,
  normalize,
  rememberEvaluate = false,
}: UseResearchFilterSyncOptions<T>) {
  const router = useRouter();
  // Chip e "Limpar filtros" somem ao aplicar: o foco vai para o total, que anuncia o resultado.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const { isPending, startTransition } = useResearchTransition();
  const [filters, setOptimisticFilters] = useOptimistic(parse(params));

  const resolvedSharedQuery = pickSharedQuery(params);
  const resolvedEvaluateQuery = rememberEvaluate ? new URLSearchParams(params).toString() : null;

  useEffect(() => {
    if (resolvedEvaluateQuery !== null) {
      rememberMarketContext({ shared: resolvedSharedQuery, evaluate: resolvedEvaluateQuery });
    } else {
      rememberMarketContext({ shared: resolvedSharedQuery });
    }
  }, [resolvedSharedQuery, resolvedEvaluateQuery]);

  function apply(changed: T, { focusStatus = false } = {}) {
    const next = normalize ? normalize(changed) : changed;
    startTransition(() => {
      setOptimisticFilters(next);
      router.push(toHref(next), { scroll: false });
    });
    if (focusStatus) statusRef.current?.focus();
  }

  return { filters, isPending, statusRef, apply };
}
