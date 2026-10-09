import { percentOf } from "./data-steps";
import { PlotFrame } from "./plot-axes";

export type LineBandPoint = { key: string; label: string; low: number; median: number; high: number };

type LineBandProps = {
  /** Em ordem, igualmente espaçados no eixo x. */
  points: readonly LineBandPoint[];
  yDomain: readonly [number, number];
  yTicks: readonly number[];
  formatY: (value: number) => string;
  ariaLabel: string;
};

/**
 * Linha da mediana sobre a faixa P25–P75 (D-45): faixa em `data-1`, linha de 2 px em `data-4` e pontos com anel de
 * `surface`. Só o primeiro e o último ponto levam o valor escrito; os outros estão na tabela equivalente.
 */
export function LineBand({ points, yDomain, yTicks, formatY, ariaLabel }: LineBandProps) {
  const xAt = (index: number) => ((index + 0.5) / points.length) * 100;
  // No SVG, y cresce para baixo.
  const yAt = (value: number) => 100 - percentOf(value, yDomain);
  const band = [
    ...points.map((point, index) => `${xAt(index)},${yAt(point.high)}`),
    ...points.toReversed().map((point, index) => `${xAt(points.length - 1 - index)},${yAt(point.low)}`),
  ].join(" ");
  const line = points.map((point, index) => `${xAt(index)},${yAt(point.median)}`).join(" ");
  const labelled = new Set([0, points.length - 1]);
  return (
    <PlotFrame
      ariaLabel={ariaLabel}
      yDomain={yDomain}
      yTicks={yTicks.map((value) => ({ value, label: formatY(value) }))}
      xTicks={points.map((point, index) => ({ key: point.key, at: xAt(index), label: point.label }))}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
        focusable="false"
      >
        <polygon points={band} className="fill-data-1" />
        <polyline
          points={line}
          fill="none"
          className="stroke-data-4"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {points.map((point, index) => (
        <span
          key={point.key}
          className="absolute flex -translate-x-1/2 translate-y-1/2 flex-col items-center"
          style={{ left: `${xAt(index)}%`, bottom: `${percentOf(point.median, yDomain)}%` }}
        >
          <span className="size-2 rounded-full bg-data-4 ring-2 ring-surface" />
          {labelled.has(index) ? (
            <span className="absolute bottom-3 text-caption leading-none font-semibold text-foreground tabular-nums">
              {formatY(point.median)}
            </span>
          ) : null}
        </span>
      ))}
    </PlotFrame>
  );
}
