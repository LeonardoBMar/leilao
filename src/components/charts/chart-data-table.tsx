import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ChartColumn = { key: string; label: string; align?: "left" | "right" };

type ChartDataTableProps = {
  columns: readonly ChartColumn[];
  rows: readonly ({ key: string } & Record<string, ReactNode>)[];
  summary?: string;
};

/**
 * "Ver dados em tabela" (D-45): a mesma informação do gráfico em linhas, fechada por padrão. É a leitura acessível de
 * todo gráfico e o lugar dos valores que o gráfico não escreve.
 */
export function ChartDataTable({ columns, rows, summary = "Ver dados em tabela" }: ChartDataTableProps) {
  const hasQuartiles = columns.some((column) => column.label === "P25" || column.label === "P75");
  return (
    <details className="group">
      <summary className="inline-flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-label text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-150 group-open:rotate-180" />
        {summary}
      </summary>
      <div className="mt-3 grid gap-2">
        <Table regionLabel={summary}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={cn(column.align === "right" && "text-right")}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={cn("tabular-nums", column.align === "right" && "text-right")}>
                    {row[column.key] ?? "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {hasQuartiles ? (
          <p className="text-caption text-muted">P25 e P75 delimitam a metade central das vendas (faixa típica).</p>
        ) : null}
      </div>
    </details>
  );
}
