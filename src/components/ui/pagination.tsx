import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button-variants";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Paginação"
      className={cn("flex w-full items-center justify-between gap-4", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex items-center gap-1", className)} {...props} />;
}

function PaginationItem(props: React.ComponentProps<"li">) {
  return <li {...props} />;
}

type PaginationLinkProps = React.ComponentProps<"a"> & {
  isActive?: boolean;
  size?: "sm" | "md" | "lg" | "icon";
};

function PaginationLink({
  className,
  isActive,
  size = "icon",
  "aria-disabled": ariaDisabled,
  tabIndex,
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      aria-disabled={ariaDisabled}
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
        ariaDisabled && "pointer-events-none text-muted-subtle",
        className,
      )}
      tabIndex={ariaDisabled ? -1 : tabIndex}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  children = "Anterior",
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink className={cn("gap-1 px-3", className)} size="md" {...props}>
      <ChevronLeft aria-hidden="true" className="size-4" />
      <span className="hidden sm:inline">{children}</span>
      <span className="sr-only sm:hidden">{children}</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, children = "Próxima", ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink className={cn("gap-1 px-3", className)} size="md" {...props}>
      <span className="hidden sm:inline">{children}</span>
      <span className="sr-only sm:hidden">{children}</span>
      <ChevronRight aria-hidden="true" className="size-4" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-10 items-center justify-center text-muted", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">Mais páginas</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
