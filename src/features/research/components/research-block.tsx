import type { ReactNode } from "react";

import { ButtonLink, Card, EmptyState, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { NoSalesSuggestion } from "../no-sales";
import { researchHref } from "../search";

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
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20 md:scroll-mt-64 lg:scroll-mt-60">
      <Card className="grid min-w-0 gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid max-w-3xl gap-1">
            <h2 id={`${id}-titulo`} className="text-heading-3 text-foreground">
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

/** Sem vendas no filtro (DESIGN.md §15.8, item 4): diz desde quando a base existe e oferece as saídas que têm venda. */
export function NoSales({ since, suggestions }: { since: Date | null; suggestions: readonly NoSalesSuggestion[] }) {
  return (
    <EmptyState
      variant="inline"
      title={`Nenhuma venda com esses filtros${since === null ? "" : ` desde ${formatDate(since)}`}`}
      description={suggestions.length === 0 ? "Troque a condição, a categoria ou o modelo." : "Afrouxe um filtro:"}
      action={
        suggestions.length === 0 ? undefined : (
          <div className="flex flex-wrap gap-2">
            {suggestions.map(({ label, filters }) => (
              <ButtonLink key={label} href={researchHref(filters)} scroll={false} variant="secondary" size="sm">
                {label}
              </ButtonLink>
            ))}
          </div>
        )
      }
    />
  );
}
