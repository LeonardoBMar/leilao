import { BellRing, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Badge, ButtonLink, EmptyState, Skeleton } from "@/components/ui";

import { listWatches } from "../queries";
import { describeCriteria, discoveredHref, watchTitle } from "../summary";
import type { WatchListItem } from "../types";
import { WatchActions } from "./watch-actions";

/** Monitores do usuário. Lê a sessão: renderizar dentro de <Suspense>. */
export async function WatchList() {
  const watches = await listWatches();

  if (watches.length === 0) {
    return (
      <EmptyState
        icon={BellRing}
        title="Nenhum monitor ainda"
        description="Diga o que você procura (ex.: VW Fox 2011–2013 até R$ 25 mil) e o app avisa quando um lote compatível aparecer."
        action={
          <ButtonLink href="/monitores/novo">
            <Plus aria-hidden="true" />
            Criar monitor
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {watches.map((watch) => (
        <li key={watch.id}>
          <WatchCard watch={watch} />
        </li>
      ))}
    </ul>
  );
}

function WatchCard({ watch }: { watch: WatchListItem }) {
  const title = watchTitle(watch.name, watch.criteria);
  const matches = `${watch.openMatches}${watch.openMatchesTruncated ? "+" : ""}`;

  return (
    <article className="grid h-full content-start gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-body font-semibold text-foreground">{title}</h2>
          <p className="text-caption text-muted">{describeCriteria(watch.criteria)}</p>
        </div>
        <Badge variant={watch.active ? "success" : "outline"}>{watch.active ? "Ligado" : "Desligado"}</Badge>
      </div>

      <ul className="grid gap-1 text-caption text-foreground-secondary">
        <li>
          <Link href={discoveredHref(watch.criteria) as Route} className="text-accent hover:underline">
            {watch.openMatches === 1 ? "1 lote aberto combina agora" : `${matches} lotes abertos combinam agora`}
          </Link>
        </li>
        <li>
          {watch.unreadAlerts > 0 ? (
            <Link href={`/alertas?monitor=${watch.id}` as Route} className="text-accent hover:underline">
              {watch.unreadAlerts === 1 ? "1 alerta não lido" : `${watch.unreadAlerts} alertas não lidos`}
            </Link>
          ) : (
            "Nenhum alerta não lido"
          )}
        </li>
      </ul>

      <WatchActions watchId={watch.id} title={title} active={watch.active} />
    </article>
  );
}

export function WatchListSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
      <Skeleton className="h-44" />
      <Skeleton className="h-44" />
    </div>
  );
}
