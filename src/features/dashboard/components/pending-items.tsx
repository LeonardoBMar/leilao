import Link from "next/link";

import { Badge, cardVariants } from "@/components/ui";
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
        <h2 id="pending-items" className="text-heading-3 text-foreground">
          Registros pendentes
        </h2>
        <Badge variant="warning" className="tabular-nums">
          {total}
        </Badge>
      </div>

      {awaitingResult.length > 0 ? (
        <Group id="pending-results" title="Aguardando resultado">
          {awaitingResult.map((item) => (
            <li key={item.lotId} className="grid gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/lotes/${item.lotId}/resultado`}
                  className="min-w-0 truncate font-semibold text-foreground hover:underline"
                >
                  {item.lotLabel}
                </Link>
                {item.toConfirm ? <Badge variant="warning">A confirmar</Badge> : null}
              </span>
              <span className="truncate text-caption text-muted">
                {item.auctionName} · {formatDate(item.startsAt)}
              </span>
            </li>
          ))}
        </Group>
      ) : null}

      {drafts.length > 0 ? (
        <Group id="pending-drafts" title="Rascunhos de análise">
          {drafts.map((draft) => (
            <li key={draft.analysisId} className="grid gap-0.5">
              <Link
                href={`/analise/${draft.analysisId}`}
                className="truncate font-semibold text-foreground hover:underline"
              >
                {draft.lotLabel} · v{draft.version}
              </Link>
              <span className="text-caption text-muted">Atualizado em {formatDateTime(draft.updatedAt)}</span>
            </li>
          ))}
        </Group>
      ) : null}
    </section>
  );
}

function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-2.5 border-t border-border-strong pt-3.5">
      <h3 id={id} className="text-caption text-muted">
        {title}
      </h3>
      <ul className="grid gap-3 text-body">{children}</ul>
    </section>
  );
}
