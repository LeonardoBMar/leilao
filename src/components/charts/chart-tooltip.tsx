import { cn } from "@/lib/utils";

/**
 * Dica de gráfico (D-45), no visual da dica do mapa: título e linhas sobre `surface-elevated`, sem atraso nem animação
 * (acompanha o ponteiro). Posicionada em `at` (% da largura do pai), virando para dentro perto das bordas; o pai é
 * `relative` e quem chama diz a altura (ex.: `bottom-full`). Não recebe ponteiro: nunca cobre o alvo.
 */
export function ChartTooltip({
  at,
  title,
  lines,
  className,
}: {
  at: number;
  title: string;
  lines: readonly string[];
  className?: string;
}) {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-20 grid w-max max-w-64 gap-0.5 rounded-md border border-border bg-surface-elevated px-3 py-2 shadow-md",
        at < 15 ? "translate-x-0" : at > 85 ? "-translate-x-full" : "-translate-x-1/2",
        className,
      )}
      style={{ left: `${at}%` }}
    >
      <p className="text-label text-foreground tabular-nums">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-caption text-foreground-secondary tabular-nums">
          {line}
        </p>
      ))}
    </div>
  );
}
