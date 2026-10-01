import Link, { type LinkProps } from "next/link";

const ITEM = "before:px-1.5 before:text-muted-subtle before:content-['/'] first:before:content-none";

/** Trilha das páginas de detalhe (DESIGN.md §9): links para os pais e a página atual por último, sem link. */
function Breadcrumbs({ children }: { children: React.ReactNode }) {
  return (
    <nav aria-label="Trilha">
      <ol className="flex flex-wrap text-label font-normal text-muted">{children}</ol>
    </nav>
  );
}

function BreadcrumbLink<RouteType>({ children, ...props }: LinkProps<RouteType> & { children: React.ReactNode }) {
  return (
    <li className={ITEM}>
      <Link className="hover:text-foreground hover:underline" {...props}>
        {children}
      </Link>
    </li>
  );
}

function BreadcrumbPage({ children }: { children: React.ReactNode }) {
  return (
    <li className={ITEM}>
      <span aria-current="page" className="text-foreground">
        {children}
      </span>
    </li>
  );
}

export { BreadcrumbLink, BreadcrumbPage, Breadcrumbs };
