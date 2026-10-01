import { cn } from "@/lib/utils";

type PageHeaderProps = React.ComponentProps<"header"> & {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
};

function PageHeader({ title, description, eyebrow, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)} {...props}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1.5 font-mono text-overline text-muted uppercase">{eyebrow}</p> : null}
        <h1 className="text-heading-1 text-foreground">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-body text-foreground-secondary md:text-body-lg md:leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}

export { PageHeader };
