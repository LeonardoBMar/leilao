import type { LotFilters, LotPositionKey, LotSortKey } from "./schemas";

export const LOT_POSITION_LABELS = {
  abaixo: "Abaixo do limite",
  "no-limite": "No limite",
  acima: "Acima do limite",
  "sem-viavel": "Sem lance viável",
  "sem-comparacao": "Sem comparação",
} satisfies Record<LotPositionKey, string>;

/** Explica cada posição no filtro (o "sem comparação" não é óbvio). */
export const LOT_POSITION_HINTS = {
  abaixo: "Lance atual menor que o limite da análise fixada.",
  "no-limite": "Lance atual igual ao limite.",
  acima: "Lance atual passou do limite.",
  "sem-viavel": "A análise fixada não deixa lance viável.",
  "sem-comparacao": "Sem análise fixada ou sem lance observado.",
} satisfies Record<LotPositionKey, string>;

export const LOT_SORT_LABELS = {
  leilao: "Data do leilão",
  folga: "Maior folga até o limite",
  atualizados: "Atualizados recentemente",
} satisfies Record<LotSortKey, string>;

export type ActiveLotFilter = { id: string; label: string; without: LotFilters };

/** Filtros ativos de Minhas análises, um chip por filtro; o "×" volta só aquele ao padrão. */
export function activeLotFilters(filters: LotFilters): ActiveLotFilter[] {
  const without = (patch: Partial<LotFilters>): LotFilters => ({ ...filters, ...patch, page: 1 });
  const chips: ActiveLotFilter[] = [];
  const add = (id: string, label: string | null, next: LotFilters) => {
    if (label !== null) chips.push({ id, label, without: next });
  };
  add("busca", filters.search ? `“${filters.search}”` : null, without({ search: undefined }));
  add("posicao", filters.position ? LOT_POSITION_LABELS[filters.position] : null, without({ position: undefined }));
  add(
    "leilao",
    filters.timing === undefined ? null : filters.timing === "proximos" ? "Leilões próximos" : "Leilões realizados",
    without({ timing: undefined }),
  );
  add(
    "analise",
    filters.analysis === undefined
      ? null
      : filters.analysis === "com"
        ? "Com análise fixada"
        : filters.analysis === "sem"
          ? "Sem análise fixada"
          : "Com rascunho",
    without({ analysis: undefined }),
  );
  add(
    "resultado",
    filters.result === undefined ? null : filters.result === "com" ? "Com resultado" : "Sem resultado",
    without({ result: undefined }),
  );
  add("acompanhados", filters.followedOnly ? "Só acompanhados" : null, without({ followedOnly: false }));
  add("arquivados", filters.archived ? "Só arquivados" : null, without({ archived: false }));
  return chips;
}

/** Sem filtros, mantendo a ordem ("Limpar tudo"). */
export function clearedLotFilters(filters: LotFilters): LotFilters {
  return {
    ...filters,
    search: undefined,
    followedOnly: false,
    analysis: undefined,
    result: undefined,
    archived: false,
    position: undefined,
    timing: undefined,
    page: 1,
  };
}
