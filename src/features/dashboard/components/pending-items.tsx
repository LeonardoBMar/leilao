import { ChevronRight, ClipboardList, FilePen, type LucideIcon, Trophy } from "lucide-react";
import Link from "next/link";

import { Badge, cardVariants } from "@/components/ui";
import { RecordResultButton } from "@/features/results/components/record-result-button";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getPendingItems } from "../queries";

/** Atalhos para concluir registros pendentes (SPEC §5). Não renderiza nada quando não há pendências. */
export async function PendingItems() {
  const { drafts, awaitingResult } = await getPendingItems();
  const total = drafts.length + awaitingResult.length;
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
        <Group id="pending-results" title="Aguardando resultado" icon={Trophy}>
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
        <Group id="pending-drafts" title="Rascunhos de análise" icon={FilePen}>
          {drafts.map((draft) => (
            <li key={draft.analysisId}>
              <Link
                href={`/analise/${draft.analysisId}`}
                className="group flex items-center justify-between gap-3 rounded-md py-0.5"
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-semibold text-foreground group-hover:underline">
                    {draft.lotLabel} · v{draft.version}
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
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-2.5 border-t border-border-strong pt-3.5">
      <h3 id={id} className="flex items-center gap-1.5 text-caption text-muted">
        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
        {title}
      </h3>
      <ul className="grid gap-3 text-body">{children}</ul>
    </section>
  );
}
