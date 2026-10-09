import { percentOf } from "./data-steps";
import { PlotFrame } from "./plot-axes";

export type ScatterPoint = { key: string; x: number; y: number; /** Dica nativa do ponto. */ title: string };

type ScatterPlotProps = {
  points: readonly ScatterPoint[];
  /** Mediana de cada valor de x, desenhada como traço em tinta. */
  medians?: readonly { x: number; y: number }[];
  /** Valores inteiros de x (anos), um rótulo para cada. */
  xValues: readonly number[];
  yDomain: readonly [number, number];
  yTicks: readonly number[];
  formatY: (value: number) => string;
  ariaLabel: string;
};

/** Meia largura da coluna de um x usada para espalhar pontos do mesmo x, sem invadir a vizinha. */
const SPREAD = 0.3;

/**
 * Dispersão com x discreto (ano-modelo) e y contínuo (D-45). Pontos do mesmo x se espalham na horizontal, em ordem,
 * para não se esconderem; cada ponto tem anel de `surface` para separar sobreposições.
 */
export function ScatterPlot({ points, medians = [], xValues, yDomain, yTicks, formatY, ariaLabel }: ScatterPlotProps) {
  const first = Math.min(...xValues);
  const last = Math.max(...xValues);
  const xDomain = [first - 0.5, last + 0.5] as const;
  const byX = Map.groupBy(points, (point) => point.x);
  const spread = (point: ScatterPoint) => {
    const group = byX.get(point.x) ?? [point];
    if (group.length === 1) return point.x;
    return point.x - SPREAD + (2 * SPREAD * group.indexOf(point)) / (group.length - 1);
  };
  return (
    <PlotFrame
      ariaLabel={ariaLabel}
      yDomain={yDomain}
      yTicks={yTicks.map((value) => ({ value, label: formatY(value) }))}
      xTicks={xValues.map((value) => ({ key: String(value), at: percentOf(value, xDomain), label: String(value) }))}
    >
      {points.map((point) => (
        <span
          key={point.key}
          title={point.title}
          className="absolute size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-data-3 ring-2 ring-surface"
          style={{ left: `${percentOf(spread(point), xDomain)}%`, bottom: `${percentOf(point.y, yDomain)}%` }}
        />
      ))}
      {medians.map((median) => (
        <span
          key={median.x}
          className="absolute h-0.5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${percentOf(median.x, xDomain)}%`, bottom: `${percentOf(median.y, yDomain)}%` }}
        />
      ))}
    </PlotFrame>
  );
}
