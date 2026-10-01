import { ClipboardCheck, FilePen, Trophy } from "lucide-react";
import Link from "next/link";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";

import { getPendingItems } from "../queries";

/** Atalhos para concluir registros pendentes (SPEC §5). Não renderiza nada quando não há pendências. */
export async function PendingItems() {
  const { drafts, awaitingResult } = await getPendingItems();
  if (drafts.length === 0 && awaitingResult.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck aria-hidden="true" className="size-5 text-muted" />
          Registros pendentes
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        {awaitingResult.length > 0 ? (
          <section aria-labelledby="pending-results" className="grid content-start gap-2">
            <h3 id="pending-results" className="text-label text-foreground-secondary">
              Aguardando resultado
            </h3>
            <ul className="grid gap-2">
              {awaitingResult.map((item) => (
                <li key={item.lotId}>
                  <Link
                    href={`/lotes/${item.lotId}/resultado`}
                    className="flex items-start gap-2 rounded-md p-2 hover:bg-surface-subtle"
                  >
                    <Trophy aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 truncate text-body text-accent">{item.lotLabel}</span>
                        {item.toConfirm ? <Badge variant="warning">A confirmar</Badge> : null}
                      </span>
                      <span className="block truncate text-caption text-muted">
                        {item.auctionName} · {formatDate(item.startsAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {drafts.length > 0 ? (
          <section aria-labelledby="pending-drafts" className="grid content-start gap-2">
            <h3 id="pending-drafts" className="text-label text-foreground-secondary">
              Rascunhos de análise
            </h3>
            <ul className="grid gap-2">
              {drafts.map((draft) => (
                <li key={draft.analysisId}>
                  <Link
                    href={`/analise/${draft.analysisId}`}
                    className="flex items-start gap-2 rounded-md p-2 hover:bg-surface-subtle"
                  >
                    <FilePen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-body text-accent">
                        {draft.lotLabel} · v{draft.version}
                      </span>
                      <span className="block text-caption text-muted">
                        Atualizado em {formatDateTime(draft.updatedAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
