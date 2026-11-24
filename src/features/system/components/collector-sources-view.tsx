import { ChevronDown, ExternalLink } from "lucide-react";

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
import { formatCompactDateTime, formatDateTime } from "@/lib/format";

import { formatDurationSec, SOURCE_HEALTH_LABELS, SOURCE_HEALTH_VARIANTS } from "../labels";
import { getSystemCollectorOverview } from "../queries";
import { SourceToggleButton } from "./source-toggle-button";

const RUN_STATUS_LABELS = {
  running: "Em andamento",
  succeeded: "Concluída",
  failed: "Falhou",
} as const;

const RUN_STATUS_VARIANTS = {
  running: "default",
  succeeded: "success",
  failed: "destructive",
} as const;

/** Painel de saúde e histórico das fontes de coleta (`/sistema`, D-88). */
export async function CollectorSourcesView() {
  const overview = await getSystemCollectorOverview();

  if (overview.sources.length === 0) {
    return (
      <EmptyState
        title="Nenhuma fonte registrada"
        description="As fontes cadastradas em src/sources/index.ts aparecem aqui após a primeira execução do coletor."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="p-4 md:p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Fontes ativas"
            note={overview.pausedCount > 0 ? `${overview.pausedCount} pausada(s)` : "Todas ativas"}
          >
            {overview.activeCount}
          </Stat>
          <Stat label="Com falha" note="Última execução falhou">
            <span className={overview.failingCount > 0 ? "text-error" : undefined}>{overview.failingCount}</span>
          </Stat>
          <Stat label="Atrasadas" note="Acima da janela de 12 h">
            <span className={overview.lateCount > 0 ? "text-warning" : undefined}>{overview.lateCount}</span>
          </Stat>
          <Stat label="Anúncios abertos" note="Em todas as fontes">
            {overview.totalOpenListings.toLocaleString("pt-BR")}
          </Stat>
        </dl>
      </Card>

      <div className="grid gap-4">
        {overview.sources.map((source) => {
          const latest = source.runs[0] ?? null;
          const latestErrors = latest?.errors ?? [];
          return (
            <Card key={source.id} className="grid gap-4 p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-body font-semibold text-foreground">{source.name}</h2>
                    {source.active ? (
                      <Badge variant={SOURCE_HEALTH_VARIANTS[source.health]}>
                        {SOURCE_HEALTH_LABELS[source.health]}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pausada</Badge>
                    )}
                    <span className="font-mono text-caption text-muted">{source.id}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted tabular-nums">
                    <span>{source.openListings.toLocaleString("pt-BR")} abertos</span>
                    {latest ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Última: {formatDateTime(latest.startedAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>Duração: {formatDurationSec(latest.durationSec)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {latest.discovered} na lista · {latest.created} novos · {latest.updated} atualizados ·{" "}
                          {latest.failed} falhas
                        </span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Nenhuma execução registrada</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <a
                      href={source.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      Site
                      <ExternalLink aria-hidden="true" className="size-3" />
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  </div>
                </div>
                <SourceToggleButton sourceId={source.id} sourceName={source.name} active={source.active} />
              </div>

              {latestErrors.length > 0 ? (
                <details className="group rounded-md border border-border bg-background px-3.5 py-2.5 text-caption">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-error [&::-webkit-details-marker]:hidden">
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 transition-transform duration-150 group-open:rotate-180"
                    />
                    {latestErrors.length === 1
                      ? "1 erro amostrado na última execução"
                      : `${latestErrors.length} erros amostrados na última execução`}
                  </summary>
                  <ul className="mt-2.5 grid gap-1.5 font-mono text-caption text-foreground-secondary">
                    {latestErrors.map((sample, index) => (
                      <li key={`${sample.url}-${index}`} className="break-all">
                        <span className="text-muted">{sample.url}</span> → {sample.error}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {source.runs.length > 0 ? (
                <details className="group">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-caption font-medium text-accent hover:underline [&::-webkit-details-marker]:hidden">
                    <ChevronDown
                      aria-hidden="true"
                      className="size-3.5 transition-transform duration-150 group-open:rotate-180"
                    />
                    Últimas {source.runs.length} execuções
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <Table className="min-w-140">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Início</TableHead>
                          <TableHead>Situação</TableHead>
                          <TableHead className="text-right">Duração</TableHead>
                          <TableHead className="text-right">Req.</TableHead>
                          <TableHead className="text-right">Lista</TableHead>
                          <TableHead className="text-right">Novos</TableHead>
                          <TableHead className="text-right">Atualiz.</TableHead>
                          <TableHead className="text-right">Falhas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {source.runs.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              {formatCompactDateTime(run.startedAt)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={RUN_STATUS_VARIANTS[run.status]}>{RUN_STATUS_LABELS[run.status]}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatDurationSec(run.durationSec)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{run.requests}</TableCell>
                            <TableCell className="text-right tabular-nums">{run.discovered}</TableCell>
                            <TableCell className="text-right tabular-nums">{run.created}</TableCell>
                            <TableCell className="text-right tabular-nums">{run.updated}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              <span className={run.failed > 0 ? "font-medium text-error" : undefined}>
                                {run.failed}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function CollectorSourcesSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-24" />
      <div className="grid gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
