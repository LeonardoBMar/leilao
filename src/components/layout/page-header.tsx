import { cn } from "@/lib/utils";

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode;
  /** Informação compacta alinhada à direita do título (ex.: linha da coleta no dashboard). */
  inlineMeta?: React.ReactNode;
  description?: React.ReactNode;
  /** Linha de contexto em mono acima do título ("LOTE 0152 · 02/10/2030"). */
  eyebrow?: string;
  /** Situação logo abaixo do título (badges, data de fixação). */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
};

function PageHeader({ title, inlineMeta, description, eyebrow, meta, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)} {...props}>
      <div className="grid min-w-0 gap-1">
        {eyebrow ? <p className="font-mono text-caption text-muted">{eyebrow}</p> : null}
        {inlineMeta ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-heading-1 text-balance text-foreground">{title}</h1>
            {inlineMeta}
          </div>
        ) : (
          <h1 className="text-heading-1 text-balance text-foreground">{title}</h1>
        )}
        {description ? <p className="max-w-3xl text-body text-pretty text-muted">{description}</p> : null}
        {meta ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-label font-normal text-muted">{meta}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export { PageHeader };
