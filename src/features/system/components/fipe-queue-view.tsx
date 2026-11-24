import type { Route } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  EmptyState,
  Skeleton,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatShortMonth } from "@/lib/format";

import { FIPE_KIND_LABELS, fipeReasonLabel } from "../labels";
import { getSystemFipeMatchEditor, listSystemFipeQueue } from "../queries";
import { type FipeQueueFilters, fipeQueueFiltersSchema } from "../schemas";
import { FipeFilterBar } from "./fipe-filter-bar";
import { FipeMatchEditor } from "./fipe-match-editor";

function itemHref(filters: FipeQueueFilters, id: string): Route {
  const params = new URLSearchParams();
  if (filters.situacao !== "none") params.set("situacao", filters.situacao);
  if (filters.origem !== "todas") params.set("origem", filters.origem);
  if (filters.busca) params.set("busca", filters.busca);
  params.set("item", id);
  return `/sistema/fipe?${params.toString()}` as Route;
}

/** Fila operacional de correlações FIPE com edição manual (`/sistema/fipe`, D-88). */
export async function FipeQueueView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = fipeQueueFiltersSchema.parse(await searchParams);
  const [{ summary, items }, editor] = await Promise.all([
    listSystemFipeQueue(filters),
    filters.item
      ? getSystemFipeMatchEditor(filters.item, { vehicleType: filters.tipo, brandCode: filters.marca })
      : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-6">
      <Card className="p-4 md:p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Sem casamento" note="Chaves na fila de revisão">
            <span className={summary.unmatched > 0 ? "text-warning" : undefined}>
              {summary.unmatched.toLocaleString("pt-BR")}
            </span>
          </Stat>
          <Stat label="Casadas" note="Versão ou família FIPE">
            {summary.matched.toLocaleString("pt-BR")}
          </Stat>
          <Stat label="Manuais" note="Nunca sobrescritas pela regra">
            {summary.manual.toLocaleString("pt-BR")}
          </Stat>
          <Stat
            label="Anúncios na fila"
            note={summary.latestTableMonth ? `Tabela ${formatShortMonth(summary.latestTableMonth)}` : "Sem tabela FIPE"}
          >
            {summary.pendingListings.toLocaleString("pt-BR")}
          </Stat>
        </dl>
      </Card>

      <FipeFilterBar key={filters.busca ?? ""} filters={filters} />

      {editor ? <FipeMatchEditor key={editor.match.id} editor={editor} filters={filters} /> : null}

      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma correlação encontrada"
          description="Tente alterar os filtros de situação, origem ou busca."
        />
      ) : (
        <Card className="overflow-x-auto">
          <Table className="min-w-160">
            <TableHeader>
              <TableRow>
                <TableHead>Veículo (chave da fonte)</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Escolha / Motivo</TableHead>
                <TableHead className="text-right">Anúncios</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isSelected = editor?.match.id === item.id;
                return (
                  <TableRow key={item.id} aria-current={isSelected ? "true" : undefined}>
                    <TableCell className="font-mono text-caption text-foreground">{item.vehicleKey}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        <Badge variant={item.kind === "none" ? "warning" : "success"}>
                          {FIPE_KIND_LABELS[item.kind]}
                        </Badge>
                        {item.origin === "manual" ? <Badge variant="outline">Manual</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-caption text-foreground-secondary">
                      {item.kind === "none"
                        ? fipeReasonLabel(item.reason)
                        : item.models.map((model) => model.label).join(" | ")}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{item.listings}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Link href={itemHref(filters, item.id)} className="text-label text-accent hover:underline">
                        {isSelected ? "Editando" : "Corrigir"}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

export function FipeQueueSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-24" />
      <Skeleton className="h-12" />
      <Skeleton className="h-80" />
    </div>
  );
}
