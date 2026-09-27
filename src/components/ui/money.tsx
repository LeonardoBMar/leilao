import type { Cents } from "@/domain/money";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type MoneyProps = Omit<React.ComponentProps<"span">, "children"> & {
  value: Cents | null;
};

/** Valor monetário com numerais tabulares. Desconhecido vira "—" em `muted`, nunca "R$ 0,00" (DESIGN.md §3.1). */
function Money({ value, className, ...props }: MoneyProps) {
  if (value === null) {
    return (
      <span className={cn("text-muted", className)} {...props}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">não informado</span>
      </span>
    );
  }
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)} {...props}>
      {formatBRL(value)}
    </span>
  );
}

export { Money };
