"use client";

import { ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useState } from "react";

import { percentOf } from "@/components/charts/data-steps";
import {
  Button,
  Input,
  MotionList,
  MotionListItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleChip,
} from "@/components/ui";
import { isSmallSample, MIN_SAMPLE } from "@/domain/research/summary";
import { formatCompactBRL, formatRatio } from "@/lib/format";
import { cn } from "@/lib/utils";

import { perWeekLabel, salesLabel, smallSampleLabel } from "../labels";
import {
  RANKING_AGE_LABELS,
  RANKING_AGES,
  RANKING_SORT_LABELS,
  RANKING_SORTS,
  type RankingAge,
  type RankingModel,
  type RankingRow,
  type RankingSort,
  rowsForAge,
  viewRanking,
} from "../ranking-view";

/** Linhas visíveis antes de "Mostrar todos". */
const RANKING_VISIBLE = 15;

/** Ano e lance viram colunas só no `xl`: antes disso a faixa ficaria estreita demais, e eles vão na legenda. */
const ROW_GRID =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_3rem_1rem] items-center gap-x-3 md:grid-cols-[1.75rem_minmax(0,13rem)_minmax(0,1fr)_3.5rem_1rem] xl:grid-cols-[1.75rem_minmax(0,12rem)_3rem_5.5rem_minmax(0,1fr)_3.5rem_1rem]";

type LinkedRow = RankingRow & { href: Route };

type RankingExplorerProps = {
  rows: readonly RankingModel<LinkedRow>[];
  /** Fim do eixo comum (o início é zero). */
  axisMax: number;
  ticks: readonly { value: number; label: string }[];
  /** Mediana de todas as vendas do filtro (todos os modelos), desenhada como referência. */
  overall: number | null;
};

/** "6 pts abaixo do geral" (pontos percentuais entre medianas). */
function versusOverall(median: number, overall: number): string {
  const points = Math.round((median - overall) * 100);
  if (points === 0) return "igual ao geral";
  return `${Math.abs(points)} ${Math.abs(points) === 1 ? "pt" : "pts"} ${points < 0 ? "abaixo" : "acima"} do geral`;
}

/** "Ano 2016 · lance R$ 32,5 mil": o contexto que separa um modelo barato de um modelo velho. */
function contextLabel({ year, bid }: RankingRow): string {
  return `${year === null ? "" : `Ano ${year} · `}lance ${formatCompactBRL(bid)}`;
}

/**
 * Ranking dos modelos explorável (D-45): busca pelo nome, idade na venda, ordem (mais vendas, menor ou maior mediana,
 * nome), as amostras pequenas sob demanda e "Mostrar todos". Cada linha traz o ano e o lance medianos e as vendas por
 * semana, para um modelo velho ou raro não parecer oportunidade só pela mediana. Cada linha é um link que abre o modelo no Avaliar: a faixa P25–P75 com a mediana numa
 * escala comum e a mediana geral tracejada; ao passar o mouse ou focar, a linha escreve as pontas da faixa e a distância
 * para o geral. A ordem e a busca são só desta tela.
 */
export function RankingExplorer({ rows, axisMax, ticks, overall }: RankingExplorerProps) {
  const [sort, setSort] = useState<RankingSort>("sales");
  const [age, setAge] = useState<RankingAge>("all");
  const [typed, setTyped] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [includeSmall, setIncludeSmall] = useState(false);
  const sortLabelId = useId();
  const ageLabelId = useId();
  const domain = [0, axisMax] as const;

  const pool = rowsForAge(rows, age);
  const smallCount = pool.filter((row) => isSmallSample(row.n)).length;
  const matching = viewRanking(pool, sort, typed, { includeSmall });
  const shown = expanded ? matching : matching.slice(0, RANKING_VISIBLE);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="Buscar no ranking"
          placeholder="Buscar modelo"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          containerClassName="w-full sm:w-56"
        />
        <span id={ageLabelId} className="sr-only">
          Idade na venda
        </span>
        <Select
          value={age}
          onValueChange={(value) => {
            const next = RANKING_AGES.find((key) => key === value);
            if (next) setAge(next);
          }}
        >
          <SelectTrigger aria-labelledby={ageLabelId} className="w-40">
            <SelectValue>{RANKING_AGE_LABELS[age]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RANKING_AGES.map((key) => (
              <SelectItem key={key} value={key}>
                {RANKING_AGE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <SelectTrigger aria-labelledby={sortLabelId} className="w-44">
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
        {smallCount > 0 ? (
          <ToggleChip pressed={includeSmall} onPressedChange={setIncludeSmall} count={smallCount}>
            Amostra pequena
          </ToggleChip>
        ) : null}
        <p role="status" className="text-label font-normal text-muted tabular-nums sm:ml-auto">
          {typed.trim() === "" ? `${matching.length} modelos` : `${matching.length} encontrados`}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-body text-muted">
          {typed.trim() !== ""
            ? "Nenhum modelo do ranking com esse nome."
            : smallCount > 0
              ? "Só há modelos com amostra pequena."
              : `Nenhum modelo tem ${MIN_SAMPLE} vendas ou mais nessa idade.`}
        </p>
      ) : (
        <div className="grid">
          <div aria-hidden="true" className={cn(ROW_GRID, "border-b border-border-strong px-2 pb-1")}>
            <span />
            <span className="hidden md:block" />
            <span className="hidden text-right text-caption leading-none text-muted xl:block">Ano</span>
            <span className="hidden text-right text-caption leading-none text-muted xl:block">Lance</span>
            <span className="relative col-span-1 h-4">
              {/* Marca perto da mediana geral sai, para o rótulo dela não encavalar. */}
              {ticks
                .filter((tick) => overall === null || Math.abs(tick.value - overall) / axisMax > 0.12)
                .map((tick) => (
                  <span
                    key={tick.value}
                    className="absolute top-0 -translate-x-1/2 text-caption leading-none text-muted tabular-nums first:translate-x-0 last:-translate-x-full"
                    style={{ left: `${percentOf(tick.value, domain)}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              {overall === null ? null : (
                <span
                  className="absolute top-0 -translate-x-1/2 rounded-sm bg-surface px-1 text-caption leading-none font-semibold text-foreground tabular-nums"
                  style={{ left: `${percentOf(overall, domain)}%` }}
                >
                  geral {formatRatio(overall)}
                </span>
              )}
            </span>
            <span />
            <span />
          </div>
          <MotionList
            as="ol"
            aria-label={`Modelos por ${RANKING_SORT_LABELS[sort].toLowerCase()}: ${shown
              .map((row) => `${row.label} ${formatRatio(row.median)}`)
              .join(", ")}`}
            className="grid"
          >
            {shown.map((row, index) => (
              <MotionListItem key={`${row.brand}|${row.model}`}>
                <RankingRowLink row={row} position={index + 1} domain={domain} overall={overall} />
              </MotionListItem>
            ))}
          </MotionList>
        </div>
      )}

      {matching.length > RANKING_VISIBLE ? (
        <Button variant="link" size="sm" className="h-10 w-fit px-0" onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Mostrar só os primeiros" : `Mostrar todos os ${matching.length} modelos`}
        </Button>
      ) : null}
    </div>
  );
}

function RankingRowLink({
  row,
  position,
  domain,
  overall,
}: {
  row: LinkedRow;
  position: number;
  domain: readonly [number, number];
  overall: number | null;
}) {
  const small = isSmallSample(row.n);
  const low = percentOf(row.low, domain);
  const median = percentOf(row.median, domain);
  const high = percentOf(row.high, domain);
  const versus = overall === null ? null : versusOverall(row.median, overall);
  return (
    <Link
      href={row.href}
      scroll={false}
      aria-label={`${row.label}: mediana ${formatRatio(row.median)} da FIPE, metade das vendas entre ${formatRatio(row.low)} e ${formatRatio(row.high)}, ${salesLabel(row.n)}, ${perWeekLabel(row.perWeek)}, lance mediano ${formatCompactBRL(row.bid)}${row.year === null ? "" : `, ano mediano ${row.year}`}${versus ? `, ${versus}` : ""}. Avaliar o modelo.`}
      className={cn(
        ROW_GRID,
        "group rounded-md border-b border-border px-2 py-2.5 outline-none hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-accent",
      )}
    >
      <span className="text-caption text-muted tabular-nums">{position}</span>
      <span className="col-span-3 min-w-0 md:col-span-1">
        <span className="block truncate text-body font-medium text-foreground">{row.label}</span>
        <span className="block truncate text-caption text-muted tabular-nums">
          {smallSampleLabel(row.n)} · {perWeekLabel(row.perWeek)} · faixa {formatRatio(row.low)}–{formatRatio(row.high)}
          {versus ? ` · ${versus}` : ""}
        </span>
        <span className="block truncate text-caption text-muted tabular-nums xl:hidden">{contextLabel(row)}</span>
      </span>
      <span className="hidden text-right text-body text-foreground tabular-nums xl:block">{row.year ?? "—"}</span>
      <span className="hidden text-right text-body text-foreground tabular-nums xl:block">
        {formatCompactBRL(row.bid)}
      </span>
      <span aria-hidden="true" className="relative col-start-2 h-6 md:col-start-auto">
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-subtle" />
        {overall === null ? null : (
          <span
            className="absolute inset-y-0 border-l border-dashed border-border-strong"
            style={{ left: `${percentOf(overall, domain)}%` }}
          />
        )}
        <span
          className={cn(
            "absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-data-3 transition-[left,width,background-color] duration-180 group-hover:bg-data-4 group-focus-visible:bg-data-4",
            small && "opacity-50",
          )}
          style={{ left: `${low}%`, width: `${high - low}%` }}
        />
        <span
          className="absolute top-1/2 size-3 -translate-1/2 rounded-full bg-foreground ring-2 ring-surface transition-[left] duration-180"
          style={{ left: `${median}%` }}
        />
      </span>
      <span className="text-right text-body font-semibold text-foreground tabular-nums">{formatRatio(row.median)}</span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 text-muted opacity-60 transition-opacity duration-120 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100"
      />
    </Link>
  );
}
