import { ChevronRight, ClipboardList, FilePen, type LucideIcon, Trophy } from "lucide-react";
import Link from "next/link";

import { Badge, cardVariants } from "@/components/ui";
import { FixAllDraftsButton } from "@/features/analyses/components/fix-all-drafts-button";
import { RecordResultButton } from "@/features/results/components/record-result-button";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getPendingItems } from "../queries";

/** Atalhos para concluir registros pendentes (SPEC §5). Não renderiza nada quando não há pendências. */
export async function PendingItems() {
  const { drafts, draftsTotal, fixableDraftsTotal, awaitingResult, awaitingResultTotal } = await getPendingItems();
  const total = draftsTotal + awaitingResultTotal;
  if (total === 0) return null;

  return (
    <section
      aria-labelledby="pending-items"
      className={cn(cardVariants({ variant: "summary" }), "grid gap-4 px-6 py-5.5")}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="pending-items" className="flex scroll-mt-20 items-center gap-2 text-heading-3 text-foreground">
          <ClipboardList aria-hidden="true" className="size-4 shrink-0 text-warning" />
          Registros pendentes
        </h2>
        <Badge variant="warning" className="tabular-nums">
          {total}
        </Badge>
      </div>

      {awaitingResult.length > 0 ? (
        <Group
          id="pending-results"
          title="Aguardando resultado"
          icon={Trophy}
          footer={
            awaitingResultTotal > awaitingResult.length ? (
              <Link
                href="/minhas-analises?acompanhados=1&resultado=sem"
                className="w-fit text-caption font-medium text-accent hover:underline"
              >
                Ver todos os {awaitingResultTotal} aguardando resultado
              </Link>
            ) : null
          }
        >
          {awaitingResult.map((item) => (
            <li key={item.lotId} className="flex items-center justify-between gap-3">
              <span className="grid min-w-0 gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/lotes/${item.lotId}`}
                    className="min-w-0 truncate font-semibold text-foreground hover:underline"
                  >
                    {item.lotLabel}
                  </Link>
                  {item.toConfirm ? <Badge variant="warning">A confirmar</Badge> : null}
                </span>
                <span className="truncate text-caption text-muted">
                  {item.auctionName} · {formatDate(item.startsAt)}
                </span>
              </span>
              <RecordResultButton lotId={item.lotId} label="Registrar" size="sm" />
            </li>
          ))}
        </Group>
      ) : null}

      {drafts.length > 0 ? (
        <Group
          id="pending-drafts"
          title="Rascunhos de análise"
          icon={FilePen}
          action={<FixAllDraftsButton fixableCount={fixableDraftsTotal} totalCount={draftsTotal} />}
          footer={
            draftsTotal > drafts.length ? (
              <Link href="/minhas-analises" className="w-fit text-caption font-medium text-accent hover:underline">
                Ver todos os {draftsTotal} rascunhos em Minhas análises
              </Link>
            ) : null
          }
        >
          {drafts.map((draft) => (
            <li key={draft.analysisId}>
              <Link
                href={`/analise/${draft.analysisId}`}
                className="group flex items-center justify-between gap-3 rounded-md py-0.5"
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-foreground group-hover:underline">
                      {draft.lotLabel} · v{draft.version}
                    </span>
                    {!draft.canFix ? <Badge variant="outline">Incompleto</Badge> : null}
                  </span>
                  <span className="text-caption text-muted">Atualizado em {formatDateTime(draft.updatedAt)}</span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-subtle transition-transform duration-120 group-hover:translate-x-0.5 group-hover:text-foreground"
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
  id,
  title,
  icon: Icon,
  action,
  footer,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-2.5 border-t border-border-strong pt-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="flex items-center gap-1.5 text-caption text-muted">
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
          {title}
        </h3>
        {action}
      </div>
      <ul className="grid gap-3 text-body">{children}</ul>
      {footer}
    </section>
  );
}
