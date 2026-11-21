import { ChevronRight, ClipboardList, FilePen, type LucideIcon, Trophy } from "lucide-react";
import Link from "next/link";

import { Badge, cardVariants } from "@/components/ui";
import { FixAllDraftsButton } from "@/features/analyses/components/fix-all-drafts-button";
import { RecordResultButton } from "@/features/results/components/record-result-button";
import { getLotResultContexts } from "@/features/results/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getPendingItems } from "../queries";

const linkFocusClass =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent";

/** Atalhos para concluir registros pendentes (SPEC §5). Não renderiza nada quando não há pendências. */
export async function PendingItems() {
  const { drafts, draftsTotal, fixableDraftsTotal, awaitingResult, awaitingResultTotal } = await getPendingItems();
  const total = draftsTotal + awaitingResultTotal;
  if (total === 0) return null;

  const resultContexts = await getLotResultContexts(awaitingResult.map((item) => item.lotId));

  return (
    <section className={cn(cardVariants({ variant: "summary" }), "grid gap-4 p-5 md:p-6")}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="pending-items" className="flex items-center gap-2 text-heading-3 text-foreground">
          <ClipboardList aria-hidden="true" className="size-4 shrink-0 text-warning" />
          Registros pendentes
        </h2>
        <Badge variant="warning" className="tabular-nums">
          {total}
        </Badge>
      </div>

      {awaitingResult.length > 0 ? (
        <Group
          title="Aguardando resultado"
          icon={Trophy}
          footer={
            awaitingResultTotal > awaitingResult.length ? (
              <Link
                href="/minhas-analises?acompanhados=1&resultado=sem"
                className={cn("w-fit py-1 text-caption font-medium text-accent hover:underline", linkFocusClass)}
              >
                Ver todos os {awaitingResultTotal} aguardando resultado
              </Link>
            ) : null
          }
        >
          {awaitingResult.map((item) => (
            <li key={item.lotId} className="flex items-center justify-between gap-3">
              <span className="grid min-w-0 gap-0.5">
                <Link
                  href={`/lotes/${item.lotId}`}
                  title={item.lotLabel}
                  className={cn("min-w-0 truncate font-semibold text-foreground hover:underline", linkFocusClass)}
                >
                  {item.lotLabel}
                </Link>
                <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted">
                  <span className="min-w-0 truncate" title={item.auctionName}>
                    {item.auctionName}
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-border-strong">
                    ·
                  </span>
                  <time dateTime={item.startsAt.toISOString()} className="shrink-0 tabular-nums">
                    {formatDate(item.startsAt)}
                  </time>
                </span>
              </span>
              <RecordResultButton
                lotId={item.lotId}
                context={resultContexts.get(item.lotId)}
                label="Registrar"
                size="sm"
              />
            </li>
          ))}
        </Group>
      ) : null}

      {drafts.length > 0 ? (
        <Group
          title="Rascunhos de análise"
          icon={FilePen}
          action={<FixAllDraftsButton fixableCount={fixableDraftsTotal} totalCount={draftsTotal} />}
          footer={
            draftsTotal > drafts.length ? (
              <Link
                href="/minhas-analises"
                className={cn("w-fit py-1 text-caption font-medium text-accent hover:underline", linkFocusClass)}
              >
                Ver todos os {draftsTotal} rascunhos em Minhas análises
              </Link>
            ) : null
          }
        >
          {drafts.map((draft) => (
            <li key={draft.analysisId}>
              <Link
                href={`/analise/${draft.analysisId}`}
                className={cn("group flex items-center justify-between gap-3 rounded-md py-1", linkFocusClass)}
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className="truncate font-semibold text-foreground group-hover:underline"
                      title={`${draft.lotLabel} · v${draft.version}`}
                    >
                      {draft.lotLabel} · v{draft.version}
                    </span>
                    {!draft.canFix ? <Badge variant="outline">Incompleto</Badge> : null}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted">
                    <span className="min-w-0 truncate" title={draft.auctionName}>
                      {draft.auctionName}
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-border-strong">
                      ·
                    </span>
                    <time dateTime={draft.startsAt.toISOString()} className="shrink-0 tabular-nums">
                      {formatDate(draft.startsAt)}
                    </time>
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </Link>
            </li>
          ))}
        </Group>
      ) : null}
    </section>
  );
}

function Group({
  title,
  icon: Icon,
  action,
  footer,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2.5 border-t border-border-strong pt-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-caption text-muted">
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
          {title}
        </h3>
        {action}
      </div>
      <ul role="list" className="grid gap-3 text-body">
        {children}
      </ul>
      {footer}
    </div>
  );
}
