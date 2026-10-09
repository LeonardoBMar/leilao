import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { type DataStep, STEP_CLASSES } from "./data-steps";

/**
 * - `colored`: amostra suficiente; fundo no passo da escala e valor escrito.
 * - `few`: poucos casos; sem cor, só a contagem.
 * - `empty`: nenhum caso; só o contorno.
 */
export type GridTile = {
  key: string;
  column: number;
  row: number;
  /** Rótulo curto (sigla). */
  label: string;
  /** Valor em destaque (mediana) ou a contagem, já formatados. */
  value?: string;
  /** Linha pequena (ex.: "297"); some no celular, onde o quadrado tem 44 px. */
  caption?: string;
  tone: { kind: "colored"; step: DataStep } | { kind: "few" } | { kind: "empty" };
  href?: Route;
  /** Texto completo para leitores de tela ("São Paulo: mediana 43% do valor de mercado, 297 vendas"). */
  ariaLabel: string;
  selected?: boolean;
};

type TileGridProps = {
  columns: number;
  rows: number;
  tiles: readonly GridTile[];
  ariaLabel: string;
};

const TONE_CLASSES = {
  few: "bg-surface-subtle text-muted",
  empty: "border border-border-strong text-muted-subtle",
} as const;

/** Mapa de quadrados (D-45, DESIGN.md §15.8): grade de tamanho fixo, cada quadrado um link quando há `href`. */
export function TileGrid({ columns, rows, tiles, ariaLabel }: TileGridProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className="grid gap-1"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, auto)`,
      }}
    >
      {tiles.map((tile) => {
        const content = (
          <>
            <span className="text-caption leading-none">{tile.label}</span>
            {tile.value ? (
              <span className="text-label leading-tight font-semibold tabular-nums">{tile.value}</span>
            ) : null}
            {tile.caption ? (
              <span className="hidden text-caption leading-none tabular-nums opacity-80 sm:block">{tile.caption}</span>
            ) : null}
          </>
        );
        const className = cn(
          "flex aspect-square min-w-0 flex-col items-center justify-center gap-0.5 rounded-md text-center",
          tile.tone.kind === "colored" ? STEP_CLASSES[tile.tone.step] : TONE_CLASSES[tile.tone.kind],
          tile.selected && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
        );
        return (
          <li key={tile.key} style={{ gridColumnStart: tile.column + 1, gridRowStart: tile.row + 1 }}>
            {tile.href ? (
              <Link
                href={tile.href}
                aria-label={tile.ariaLabel}
                aria-current={tile.selected ? "true" : undefined}
                scroll={false}
                className={cn(
                  className,
                  "transition-[filter] duration-120 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                )}
              >
                {content}
              </Link>
            ) : (
              <span aria-label={tile.ariaLabel} role="img" className={className}>
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type LegendItem = { key: string; swatch: DataStep | "few" | "empty"; label: ReactNode };

/** Legenda da escala: um quadradinho por passo com a faixa de valores, e os casos sem cor. */
export function TileLegend({ title, items }: { title: string; items: readonly LegendItem[] }) {
  return (
    <div className="grid gap-2">
      <p className="text-caption text-muted">{title}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5 text-caption text-foreground-secondary tabular-nums">
            <span
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0 rounded-sm",
                typeof item.swatch === "number" ? STEP_CLASSES[item.swatch] : TONE_CLASSES[item.swatch],
              )}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
