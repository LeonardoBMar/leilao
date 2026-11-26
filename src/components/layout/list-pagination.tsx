import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";

type ListPaginationProps = {
  basePath: string;
  /** Parâmetros atuais da URL (filtros), preservados ao trocar de página. */
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  /** Nome do parâmetro de página na URL. */
  pageParam?: string;
};

/** Paginação por links (DESIGN.md §5.12): "X–Y de Z", anterior/próxima e números a partir de `sm`. */
export function ListPagination({ basePath, params, page, pageSize, total, pageParam = "pagina" }: ListPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set(pageParam, String(target));
    else search.delete(pageParam);
    const query = search.toString();
    return (query ? `${basePath}?${query}` : basePath) as Route;
  };

  const pages = visiblePages(page, pageCount);

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-caption text-muted tabular-nums" aria-live="polite">
        {first}–{last} de {total}
      </p>
      <ul className="flex items-center gap-1">
        <li>
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Anterior">
            <ChevronLeft aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </PageLink>
        </li>
        {pages.map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="hidden px-2 text-muted sm:block">
              …
            </li>
          ) : (
            <li key={item} className="hidden sm:block">
              <Link
                href={hrefFor(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Página ${item}`}
                className={cn(
                  buttonVariants({ variant: item === page ? "outline" : "ghost", size: "icon" }),
                  "text-body",
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        <li>
          <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} label="Próxima">
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </PageLink>
        </li>
      </ul>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: Route;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(buttonVariants({ variant: "ghost", size: "md" }), "gap-1 px-3");
  if (disabled) {
    return (
      <span
        role="link"
        aria-disabled="true"
        aria-label={label}
        className={cn(className, "pointer-events-none text-muted-subtle")}
      >
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  );
}

/** Primeira, última e vizinhas da atual, com lacunas: 1 … 4 5 6 … 12. */
function visiblePages(page: number, pageCount: number): (number | "gap")[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pageCount).toSorted((a, b) => a - b);
  return sorted.flatMap((n, i) => {
    const previous = sorted[i - 1];
    return previous !== undefined && n - previous > 1 ? (["gap", n] as const) : [n];
  });
}
