"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import type { StateCode } from "@/domain/research/states";
import { cn } from "@/lib/utils";

import { BRAZIL_VIEWBOX, STATE_SHAPES, type StateShape } from "./brazil-geometry";
import type { DataStep } from "./data-steps";

/**
 * - `colored`: amostra suficiente; preenchido no passo da escala e valor escrito.
 * - `few`: poucos casos; cinza claro, só a contagem.
 * - `empty`: nenhum caso; só o contorno.
 */
export type RegionTone = { kind: "colored"; step: DataStep } | { kind: "few" } | { kind: "empty" };

export type MapRegion = {
  state: StateCode;
  tone: RegionTone;
  /** Valor escrito no estado (mediana, ou a contagem com poucas vendas), já formatado. */
  value?: string;
  href?: Route;
  selected: boolean;
  /** Texto completo para leitores de tela ("São Paulo: mediana 43% do valor de mercado, 297 vendas"). */
  ariaLabel: string;
  /** Dica ao passar o mouse ou focar: título e linhas. */
  tooltip: { title: string; lines: readonly string[] };
};

type BrazilMapProps = {
  regions: readonly MapRegion[];
  ariaLabel: string;
};

const FILL_CLASSES = {
  1: "fill-data-1",
  2: "fill-data-2",
  3: "fill-data-3",
  4: "fill-data-4",
  5: "fill-data-5",
} as const satisfies Record<DataStep, string>;

/** Cor do rótulo dentro do estado: tinta nos passos claros, branco nos escuros (DESIGN.md §3.1). */
const LABEL_CLASSES = {
  1: "text-foreground",
  2: "text-foreground",
  3: "text-white",
  4: "text-white",
  5: "text-white",
} as const satisfies Record<DataStep, string>;

const percentX = (x: number) => `${(x / BRAZIL_VIEWBOX.width) * 100}%`;
const percentY = (y: number) => `${(y / BRAZIL_VIEWBOX.height) * 100}%`;

/**
 * Mapa do Brasil por estado (D-45): cor pela escala sequencial, rótulo com a sigla e o valor (fora do estado, com linha
 * guia, nos pequenos), dica ao passar o mouse ou focar e um link por estado com venda. Os textos são HTML sobre o SVG
 * para não encolher com o desenho no celular; abaixo de 28 rem de largura, o rótulo dentro do estado fica numa linha.
 */
export function BrazilMap({ regions, ariaLabel }: BrazilMapProps) {
  const [active, setActive] = useState<StateCode | null>(null);
  const byState = new Map(regions.map((region) => [region.state, region]));
  const shapes = STATE_SHAPES.flatMap((shape) => {
    const region = byState.get(shape.state);
    return region ? [{ shape, region }] : [];
  });
  // Ordem de desenho: vazios por baixo, o escolhido por cima (o contorno de destaque não fica coberto).
  const drawOrder = shapes.toSorted(
    (a, b) => drawRank(a.region) - drawRank(b.region) || a.shape.state.localeCompare(b.shape.state),
  );
  const activeShape = shapes.find(({ shape }) => shape.state === active);

  return (
    <figure className="@container relative w-full">
      <svg
        viewBox={`0 0 ${BRAZIL_VIEWBOX.width} ${BRAZIL_VIEWBOX.height}`}
        className="block h-auto w-full overflow-visible"
        role="group"
        aria-label={ariaLabel}
      >
        {drawOrder.map(({ shape, region }) => (
          <StatePath
            key={shape.state}
            shape={shape}
            region={region}
            onActivate={() => setActive(shape.state)}
            onDeactivate={() => setActive((current) => (current === shape.state ? null : current))}
          />
        ))}
        {activeShape ? (
          <path
            aria-hidden="true"
            d={activeShape.shape.path}
            className="pointer-events-none fill-none stroke-foreground"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {shapes.map(({ shape: { state, label }, region }) =>
          label.callout && region.tone.kind !== "empty" ? (
            <line
              key={state}
              aria-hidden="true"
              x1={label.x}
              y1={label.y}
              x2={label.callout.x - 4}
              y2={label.callout.y}
              className="pointer-events-none stroke-border-strong"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}
      </svg>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {shapes.map(({ shape, region }) => (
          <StateLabel key={shape.state} shape={shape} region={region} />
        ))}
      </div>

      {activeShape ? <Tooltip shape={activeShape.shape} region={activeShape.region} /> : null}
    </figure>
  );
}

function drawRank(region: MapRegion): number {
  if (region.selected) return 3;
  return region.tone.kind === "empty" ? 0 : region.tone.kind === "few" ? 1 : 2;
}

function StatePath({
  shape,
  region,
  onActivate,
  onDeactivate,
}: {
  shape: StateShape;
  region: MapRegion;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const { tone } = region;
  const path = (
    <path
      d={shape.path}
      className={cn(
        tone.kind === "colored" && cn(FILL_CLASSES[tone.step], "stroke-surface"),
        tone.kind === "few" && "fill-surface-subtle stroke-surface",
        tone.kind === "empty" && "fill-surface stroke-border-strong",
        region.selected && "stroke-accent",
      )}
      strokeWidth={region.selected ? 3 : tone.kind === "empty" ? 1 : 1.5}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
  if (!region.href) {
    return (
      <g role="img" aria-label={region.ariaLabel} onMouseEnter={onActivate} onMouseLeave={onDeactivate}>
        {path}
      </g>
    );
  }
  return (
    <Link
      href={region.href}
      scroll={false}
      aria-label={region.ariaLabel}
      aria-current={region.selected ? "true" : undefined}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className="cursor-pointer outline-none [&:focus-visible>path]:stroke-accent [&:focus-visible>path]:[stroke-width:3]"
    >
      {path}
    </Link>
  );
}

function StateLabel({ shape: { state, label }, region }: { shape: StateShape; region: MapRegion }) {
  const { tone } = region;
  if (label.callout && !(tone.kind === "empty" && label.codeInside)) {
    if (tone.kind === "empty") return null;
    return (
      <span
        className="absolute -translate-y-1/2 rounded-sm bg-surface/90 px-1 py-0.5 text-caption leading-none whitespace-nowrap text-foreground-secondary tabular-nums"
        style={{ left: percentX(label.callout.x), top: percentY(label.callout.y) }}
      >
        {state} <span className="font-semibold text-foreground">{region.value}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "absolute flex -translate-1/2 flex-col items-center leading-none whitespace-nowrap tabular-nums",
        tone.kind === "colored" ? LABEL_CLASSES[tone.step] : tone.kind === "few" ? "text-muted" : "text-muted-subtle",
      )}
      style={{ left: percentX(label.x), top: percentY(label.y) }}
    >
      {/* Mapa estreito (celular): uma linha só, o valor no estado colorido e a sigla no de poucas vendas. */}
      <span className={cn("text-caption leading-none", tone.kind === "colored" && "@max-[28rem]:hidden")}>{state}</span>
      {region.value ? (
        <span className={cn("text-label leading-tight font-semibold", tone.kind === "few" && "@max-[28rem]:hidden")}>
          {region.value}
        </span>
      ) : null}
    </span>
  );
}

/** Dica sobre o estado: acima do rótulo, virando para dentro perto das bordas. */
function Tooltip({ shape: { label }, region }: { shape: StateShape; region: MapRegion }) {
  const point = label.callout ?? label;
  const side = point.x / BRAZIL_VIEWBOX.width;
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-10 mb-3 grid w-max max-w-60 gap-0.5 rounded-md border border-border bg-surface-elevated px-3 py-2 shadow-md",
        side < 0.3 ? "translate-x-0" : side > 0.7 ? "-translate-x-full" : "-translate-x-1/2",
      )}
      // Ancorada pela base: a dica sobe a partir do rótulo, qualquer que seja a altura dela.
      style={{ left: percentX(point.x), bottom: `${100 - (point.y / BRAZIL_VIEWBOX.height) * 100}%` }}
    >
      <p className="text-label text-foreground">{region.tooltip.title}</p>
      {region.tooltip.lines.map((line) => (
        <p key={line} className="text-caption text-foreground-secondary tabular-nums">
          {line}
        </p>
      ))}
    </div>
  );
}
