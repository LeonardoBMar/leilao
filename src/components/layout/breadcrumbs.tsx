import Link, { type LinkProps } from "next/link";

/** Trilha das páginas de detalhe (DESIGN.md §9): links para os pais e a página atual por último, sem link. */
function Breadcrumbs({ children }: { children: React.ReactNode }) {
  return (
    <nav aria-label="Trilha">
      <ol className="flex flex-wrap items-center text-label font-normal text-muted">{children}</ol>
    </nav>
  );
}

function BreadcrumbLink<RouteType>({ children, ...props }: LinkProps<RouteType> & { children: React.ReactNode }) {
  return (
    <li className="group/crumb flex items-center">
      <span aria-hidden="true" className="px-1.5 text-muted-subtle select-none group-first/crumb:hidden">
        /
      </span>
      <Link
        className="inline-flex min-h-10 items-center rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent sm:min-h-0"
        {...props}
      >
        {children}
      </Link>
    </li>
  );
}

function BreadcrumbPage({ children }: { children: React.ReactNode }) {
  return (
    <li className="group/crumb flex items-center">
      <span aria-hidden="true" className="px-1.5 text-muted-subtle select-none group-first/crumb:hidden">
        /
      </span>
      <span aria-current="page" className="text-foreground forced-colors:underline">
        {children}
      </span>
    </li>
  );
}

export { BreadcrumbLink, BreadcrumbPage, Breadcrumbs };
