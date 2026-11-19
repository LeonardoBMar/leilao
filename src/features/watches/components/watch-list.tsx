import { BellRing, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Badge, ButtonLink, EmptyState, MotionList, MotionListItem, Skeleton } from "@/components/ui";

import { listWatches } from "../queries";
import { discoveredHref, watchTitle } from "../summary";
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
    <MotionList className="border-b border-border">
      {watches.map((watch) => (
        <MotionListItem key={watch.id}>
          <WatchCard watch={watch} />
        </MotionListItem>
      ))}
    </MotionList>
  );
}

function WatchCard({ watch }: { watch: WatchListItem }) {
  const title = watchTitle(watch.name, watch.criteria);

  return (
    <article className="grid gap-3 border-t border-border py-4.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={watch.active ? "text-heading-3 text-foreground" : "text-heading-3 text-muted"}>{title}</h2>
          <Badge variant={watch.active ? "default" : "outline"}>{watch.active ? "Ligado" : "Desligado"}</Badge>
        </div>
        <p className="text-label font-normal text-muted">{watch.description}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-label font-normal text-foreground-secondary">
          <li>
            <Link href={discoveredHref(watch.criteria)} className="text-accent hover:underline">
              {watch.openMatches === 1
                ? "1 lote aberto combina agora"
                : `${watch.openMatches} lotes abertos combinam agora`}
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
      </div>

      <WatchActions watchId={watch.id} title={title} active={watch.active} />
    </article>
  );
}

export function WatchListSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
