import { cn } from "@/lib/utils";

type TableProps = React.ComponentProps<"table"> & {
  /** Rótulo acessível da região rolável da tabela. */
  regionLabel?: string;
};

function Table({ className, regionLabel = "Tabela de dados", ...props }: TableProps) {
  return (
    <div
      role="region"
      aria-label={regionLabel}
      tabIndex={0}
      className="relative w-full max-w-full min-w-0 overflow-x-auto rounded-sm bg-surface outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent"
    >
      <table className={cn("w-full caption-bottom text-body", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn(className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot className={cn("border-t border-border-strong font-medium", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "min-h-11 border-b border-border transition-colors duration-120 data-[interactive=true]:hover:bg-background data-[state=selected]:bg-accent-subtle",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-9 border-b border-border px-3 text-start align-middle text-caption font-medium whitespace-nowrap text-muted first:ps-0 last:pe-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn("h-11 px-3 py-2 align-middle text-foreground tabular-nums first:ps-0 last:pe-0", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("mt-3 text-body text-muted", className)} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
