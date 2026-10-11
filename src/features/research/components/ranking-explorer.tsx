"use client";

import type { Route } from "next";
import { useId, useState } from "react";

import { RangeBars } from "@/components/charts/range-bars";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { isSmallSample } from "@/domain/research/summary";
import { formatRatio } from "@/lib/format";

import { salesLabel, smallSampleLabel } from "../labels";
import { RANKING_SORT_LABELS, RANKING_SORTS, type RankingRow, type RankingSort, viewRanking } from "../ranking-view";

/** Linhas visíveis antes de "Mostrar todos". */
const RANKING_VISIBLE = 15;

type RankingExplorerProps = {
  rows: readonly (RankingRow & { href: Route })[];
  /** Fim do eixo comum (o início é zero). */
  axisMax: number;
  ticks: readonly { value: number; label: string }[];
};

/**
 * Ranking dos modelos explorável (D-45): busca pelo nome, ordem (menor ou maior mediana, mais vendas, nome) e "Mostrar
 * todos". A ordem e a busca são só desta tela; cada linha aplica o filtro do modelo pela URL.
 */
export function RankingExplorer({ rows, axisMax, ticks }: RankingExplorerProps) {
  const [sort, setSort] = useState<RankingSort>("lowest");
  const [typed, setTyped] = useState("");
  const [expanded, setExpanded] = useState(false);
  const sortLabelId = useId();

  const matching = viewRanking(rows, sort, typed);
  const shown = expanded ? matching : matching.slice(0, RANKING_VISIBLE);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-center">
        <Input
          type="search"
          aria-label="Buscar no ranking"
          placeholder="Buscar modelo"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          containerClassName="sm:w-64"
        />
        <span id={sortLabelId} className="sr-only">
          Ordenar por
        </span>
        <Select
          value={sort}
          onValueChange={(value) => {
            const next = RANKING_SORTS.find((key) => key === value);
            if (next) setSort(next);
          }}
        >
          <SelectTrigger aria-labelledby={sortLabelId} className="sm:w-44">
            <SelectValue>{RANKING_SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RANKING_SORTS.map((key) => (
              <SelectItem key={key} value={key}>
                {RANKING_SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p role="status" className="col-span-2 text-label font-normal text-muted tabular-nums sm:ml-auto">
          {typed.trim() === "" ? `${rows.length} modelos` : `${matching.length} de ${rows.length} modelos`}
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="text-body text-muted">Nenhum modelo do ranking com esse nome.</p>
      ) : (
        <RangeBars
          ariaLabel={`Modelos por ${RANKING_SORT_LABELS[sort].toLowerCase()}: ${shown
            .map((row) => `${row.label} ${formatRatio(row.median)}`)
            .join(", ")}`}
          domain={[0, axisMax]}
          ticks={ticks}
          reference={axisMax > 1 ? 1 : undefined}
          rows={shown.map((row) => ({
            key: `${row.brand}|${row.model}`,
            label: row.label,
            low: row.low,
            median: row.median,
            high: row.high,
            valueLabel: formatRatio(row.median),
            detail: smallSampleLabel(row.n),
            faint: isSmallSample(row.n),
            href: row.href,
            ariaLabel: `${row.label}: mediana ${formatRatio(row.median)} do valor de mercado, faixa do meio ${formatRatio(row.low)} a ${formatRatio(row.high)}, ${salesLabel(row.n)}`,
          }))}
        />
      )}
      {matching.length > RANKING_VISIBLE ? (
        <Button variant="link" size="sm" className="h-10 w-fit px-0" onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Mostrar só os primeiros" : `Mostrar todos os ${matching.length} modelos`}
        </Button>
      ) : null}
    </div>
  );
}
