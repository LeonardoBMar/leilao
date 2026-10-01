import { cn } from "@/lib/utils";

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Linha de contexto em mono acima do título ("LOTE 0152 · 02/10/2030"). */
  eyebrow?: string;
  /** Situação logo abaixo do título (badges, data de fixação). */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
};

function PageHeader({ title, description, eyebrow, meta, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)} {...props}>
      <div className="grid min-w-0 gap-1.5">
        {eyebrow ? <p className="font-mono text-overline text-muted uppercase">{eyebrow}</p> : null}
        <h1 className="text-heading-1 text-foreground">{title}</h1>
        {description ? <p className="max-w-3xl text-body text-muted">{description}</p> : null}
        {meta ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-label font-normal text-muted">{meta}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export { PageHeader };
