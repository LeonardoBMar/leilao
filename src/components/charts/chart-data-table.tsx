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
  return (
    <details className="group">
      <summary className="w-fit cursor-pointer text-label text-accent hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {summary}
      </summary>
      <div className="mt-3">
        <Table>
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
      </div>
    </details>
  );
}
