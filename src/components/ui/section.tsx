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

export { DataList, DataRow, Section, SectionHeader, SectionTitle };
