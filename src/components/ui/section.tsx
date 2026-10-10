import { cn } from "@/lib/utils";

/**
 * Seção de página da direção A (DESIGN.md §5.4): título de seção e conteúdo separado por linhas finas, sem caixa.
 * Use no lugar de `Card` quando o bloco não precisa de borda própria.
 */
function Section({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("grid min-w-0 content-start gap-3.5", className)} {...props} />;
}

function SectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-h-8 flex-wrap items-center justify-between gap-3", className)} {...props} />;
}

function SectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-heading-3 text-foreground", className)} {...props} />;
}

/** Linhas de rótulo e valor com divisores finos (resumos financeiros, ficha do veículo). */
function DataList({ className, ...props }: React.ComponentProps<"dl">) {
  return <dl className={cn("grid border-b border-border", className)} {...props} />;
}

type DataRowProps = React.ComponentProps<"div"> & { label: React.ReactNode; emphasis?: boolean };

function DataRow({ label, emphasis = false, className, children, ...props }: DataRowProps) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-t border-border py-2.75 text-body tabular-nums",
        emphasis && "border-border-strong font-semibold",
        className,
      )}
      {...props}
    >
      <dt className={cn("min-w-0", emphasis ? "text-foreground" : "text-foreground-secondary")}>{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}

const STAT_SIZES = {
  body: "text-body",
  lg: "text-body-lg tabular-nums",
  "heading-3": "text-heading-3",
  "heading-2": "text-heading-2",
} as const;

type StatProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  children: React.ReactNode;
  /** Tamanho do valor: `body` em fichas, `lg` em fatos, `heading-2`/`heading-3` em números de destaque. */
  size?: keyof typeof STAT_SIZES;
  /** Linha discreta abaixo do valor (origem, data da observação). */
  note?: React.ReactNode;
  /** Conteúdo extra abaixo, como um botão de ação. */
  footer?: React.ReactNode;
  valueClassName?: string;
};

/** Rótulo pequeno sobre um valor, em colunas (`<dl>` em grade). Para linhas rótulo ↔ valor, use `DataRow`. */
function Stat({ label, size = "body", note, footer, valueClassName, className, children, ...props }: StatProps) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1", className)} {...props}>
      <dt className="text-caption text-muted">{label}</dt>
      <dd className={cn("text-foreground", STAT_SIZES[size], valueClassName)}>{children}</dd>
      {note ? <dd className="text-caption text-muted">{note}</dd> : null}
      {footer ? <dd>{footer}</dd> : null}
    </div>
  );
}

export { DataList, DataRow, Section, SectionHeader, SectionTitle, Stat };
