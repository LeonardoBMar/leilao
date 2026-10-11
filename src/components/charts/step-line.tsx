import { percentOf } from "./data-steps";
import { PlotFrame } from "./plot-axes";

export type StepPoint = {
  key: string;
  x: number;
  y: number;
  /** Texto do ponto (dica nativa e leitor de tela da tabela ao lado). */
  title: string;
};

type StepLineProps = {
  /** Em ordem de x; cada valor vale até o ponto seguinte. */
  points: readonly StepPoint[];
  xDomain: readonly [number, number];
  xTicks: readonly { value: number; label: string }[];
  yDomain: readonly [number, number];
  yTicks: readonly { value: number; label: string }[];
  /** Linha horizontal tracejada de referência, com o rótulo à direita. */
  reference?: { value: number; label: string };
  /** Valor escrito sobre o último ponto. */
  endLabel?: string;
  ariaLabel: string;
};

/**
 * Linha em degraus (D-45): o valor fica igual até a próxima observação (o último, até o fim do eixo), sem interpolar.
 * Linha de 2 px em `data-4`, pontos onde o valor muda e o último destacado com o valor escrito. O eixo y não precisa
 * começar no zero.
 */
export function StepLine({ points, xDomain, xTicks, yDomain, yTicks, reference, endLabel, ariaLabel }: StepLineProps) {
  const xAt = (value: number) => percentOf(value, xDomain);
  const yAt = (value: number) => 100 - percentOf(value, yDomain);
  const path = points
    .flatMap((point, index) => {
      const next = points[index + 1];
      // O último valor vale até o fim do eixo.
      return [`${xAt(point.x)},${yAt(point.y)}`, `${xAt(next?.x ?? xDomain[1])},${yAt(point.y)}`];
    })
    .join(" ");
  const last = points.at(-1);
  return (
    <PlotFrame
      ariaLabel={ariaLabel}
      yDomain={yDomain}
      yTicks={yTicks}
      xTicks={xTicks.map(({ value, label }) => ({ key: String(value), at: xAt(value), label }))}
    >
      {reference ? (
        <span
          className="absolute inset-x-0 border-t border-dashed border-border-strong"
          style={{ bottom: `${percentOf(reference.value, yDomain)}%` }}
        >
          <span className="absolute bottom-1 left-1 text-caption leading-none text-muted">{reference.label}</span>
        </span>
      ) : null}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
        focusable="false"
      >
        <polyline
          points={path}
          fill="none"
          className="stroke-data-4"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {points.map((point) => (
        <span
          key={point.key}
          title={point.title}
          className="absolute flex size-4 -translate-x-1/2 translate-y-1/2 items-center justify-center"
          style={{ left: `${xAt(point.x)}%`, bottom: `${percentOf(point.y, yDomain)}%` }}
        >
          <span
            className={
              point === last
                ? "size-3 rounded-full bg-data-5 ring-2 ring-surface"
                : "size-2 rounded-full bg-data-4 ring-2 ring-surface"
            }
          />
          {point === last && endLabel ? (
            <span className="absolute right-1 bottom-4 text-caption leading-none font-semibold whitespace-nowrap text-foreground tabular-nums">
              {endLabel}
            </span>
          ) : null}
        </span>
      ))}
    </PlotFrame>
  );
}
