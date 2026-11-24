import { BellRing } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { ListPagination } from "@/components/layout/list-pagination";
import { ButtonLink, EmptyState, LinkTabs, MotionList, MotionListItem, Skeleton } from "@/components/ui";

import { listAlerts } from "../queries";
import { alertFiltersSchema } from "../schemas";
import { MarkAllAlertsReadButton } from "./alert-buttons";
import { AlertCard } from "./alert-card";

/** Cards na primeira linha no layout mais largo (3 colunas). */
const FIRST_ROW = 3;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Lista de alertas com filtro por situação e por monitor. Renderizar dentro de <Suspense>. */
export async function AlertsView({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const first = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const filters = alertFiltersSchema.parse({
    monitor: first("monitor"),
    situacao: first("situacao"),
    pagina: first("pagina"),
  });
  const page = await listAlerts(filters);
  const hrefWith = (situacao: "todos" | "nao-lidos") => {
    const params = new URLSearchParams();
    if (filters.watchId) params.set("monitor", filters.watchId);
    if (situacao === "todos") params.set("situacao", situacao);
    const query = params.toString();
    return (query ? `/alertas?${query}` : "/alertas") as Route;
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <LinkTabs
            label="Situação dos alertas"
            tabs={[
              { href: hrefWith("nao-lidos"), label: `Não lidos (${page.unread})`, active: filters.unreadOnly },
              { href: hrefWith("todos"), label: "Todos", active: !filters.unreadOnly },
            ]}
          />
          {page.watchTitle ? (
            <span className="text-caption text-muted">
              Monitor “{page.watchTitle}” ·{" "}
              <Link href="/alertas" className="text-accent hover:underline">
                ver de todos
              </Link>
            </span>
          ) : null}
        </div>
        {page.unread > 0 ? <MarkAllAlertsReadButton watchId={filters.watchId ?? null} /> : null}
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={BellRing}
          title={filters.unreadOnly ? "Nenhum alerta não lido" : "Nenhum alerta ainda"}
          description="A cada coleta (de 4 em 4 horas), lotes novos que combinam com um monitor ligado aparecem aqui."
          action={
            <ButtonLink href="/monitores" variant="secondary">
              Ver monitores
            </ButtonLink>
          }
        />
      ) : (
        <section aria-label="Alertas" className="grid gap-4">
          <MotionList className="grid gap-x-7 gap-y-11 sm:grid-cols-2 xl:grid-cols-3">
            {page.items.map((alert, index) => (
              <MotionListItem key={alert.id}>
                <AlertCard alert={alert} eager={index < FIRST_ROW} />
              </MotionListItem>
            ))}
          </MotionList>
          <ListPagination
            basePath="/alertas"
            params={{ monitor: filters.watchId, situacao: filters.unreadOnly ? undefined : "todos" }}
            page={page.page}
            pageSize={page.pageSize}
            total={page.total}
          />
        </section>
      )}
    </div>
  );
}

export function AlertsViewSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
