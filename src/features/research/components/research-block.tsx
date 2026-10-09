import type { ReactNode } from "react";

import { Card, EmptyState, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ResearchBlockProps = {
  id: string;
  title: string;
  /** Linha de apoio: o que a medida é e como ler o gráfico. */
  description?: ReactNode;
  /** Ao lado do título (ex.: troca de medida). */
  actions?: ReactNode;
  children: ReactNode;
};

/** Bloco da Pesquisa (DESIGN.md §15.8): título, apoio em `muted` e o gráfico sobre `surface`. */
export function ResearchBlock({ id, title, description, actions, children }: ResearchBlockProps) {
  return (
    <section aria-labelledby={id}>
      <Card className="grid min-w-0 gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid max-w-3xl gap-1">
            <h2 id={id} className="text-heading-3 text-foreground">
              {title}
            </h2>
            {description ? <p className="text-body text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
        {children}
      </Card>
    </section>
  );
}

/** O bloco enquanto carrega: o título já aparece, o gráfico é um retângulo. */
export function ResearchBlockSkeleton({ title, className }: { title: string; className?: string }) {
  return (
    <Card className="grid gap-5 p-5 md:p-6">
      <div className="grid gap-2">
        <p className="text-heading-3 text-foreground">{title}</p>
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className={cn("h-64 w-full", className)} />
    </Card>
  );
}

/** Sem vendas no filtro (DESIGN.md §15.8, item 4). */
export function NoSales({ since }: { since: Date | null }) {
  return (
    <EmptyState
      variant="inline"
      title={`Nenhuma venda com esses filtros${since === null ? "" : ` desde ${formatDate(since)}`}`}
      description="Troque a condição, a categoria ou o modelo."
    />
  );
}
