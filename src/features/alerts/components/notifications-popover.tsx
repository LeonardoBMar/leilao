"use client";

import { AlertTriangle, Bell, BellRing, Check, CheckCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge, Button, Popover, PopoverContent, PopoverTrigger, useActionToast } from "@/components/ui";
import { formatCompactDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { markAlertReadAction, markAllAlertsReadAction } from "../actions";
import type { RecentUnreadAlert } from "../queries";

export type CollectorNotification = {
  variant: "destructive" | "warning";
  label: string;
  impact: string;
};

type NotificationsPopoverProps = {
  collectorWarning: CollectorNotification | null;
  alerts: readonly RecentUnreadAlert[];
  unreadTotal: number;
  isAdmin?: boolean;
};

/** Central de notificações no header: exibe falhas/atrasos de coleta e novos alertas não lidos. */
export function NotificationsPopover({
  collectorWarning,
  alerts,
  unreadTotal,
  isAdmin = false,
}: NotificationsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [confirmMarkAll, setConfirmMarkAll] = useState(false);
  const { isPending: isMarkingRead, run: runMarkRead } = useActionToast();
  const totalCount = unreadTotal + (collectorWarning ? 1 : 0);
  const hasNotifications = totalCount > 0;
  const isDestructive = collectorWarning?.variant === "destructive";
  const isWarning = collectorWarning?.variant === "warning";

  const statusSuffix = isDestructive
    ? " — falha na coleta"
    : isWarning
      ? ` — ${collectorWarning.label.toLowerCase()}`
      : "";

  const triggerLabel = hasNotifications
    ? `Notificações (${totalCount} ${totalCount === 1 ? "pendente" : "pendentes"}${statusSuffix})`
    : "Notificações";

  const countBadgeVariant = isDestructive ? "destructive" : isWarning ? "warning" : "outline";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmMarkAll(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={triggerLabel}
          className={cn(
            "relative size-10 text-muted hover:text-foreground sm:size-9 pointer-coarse:size-11",
            isDestructive && "text-error hover:text-error",
          )}
        >
          <Bell aria-hidden="true" strokeWidth={1.75} className="size-4" />
          {isDestructive ? (
            <span
              aria-hidden="true"
              className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-error text-caption leading-none font-bold text-surface ring-2 ring-surface"
            >
              !
            </span>
          ) : hasNotifications ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1.5 right-1.5 size-2 rounded-full ring-2 ring-surface",
                isWarning ? "bg-warning" : "bg-accent",
              )}
            />
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" aria-label="Notificações" className="w-90 gap-0 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-label font-semibold text-foreground">Notificações</p>
          {hasNotifications ? (
            <Badge variant={countBadgeVariant} className="tabular-nums">
              {totalCount} {totalCount === 1 ? "item" : "itens"}
            </Badge>
          ) : null}
        </div>

        {!hasNotifications ? (
          <div className="grid gap-1 px-4 py-6 text-center">
            <p className="text-body font-medium text-foreground">Tudo em dia</p>
            <p className="text-caption text-muted">Falhas de coleta e novos alertas aparecerão aqui.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {collectorWarning ? (
              <div className="grid gap-2 px-4 py-3">
                <p className="font-mono text-overline text-muted uppercase">Coleta</p>
                {isAdmin ? (
                  <Link
                    href="/sistema"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group flex items-start gap-2.5 rounded-md border p-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent",
                      isDestructive
                        ? "border-error-border bg-error-subtle hover:bg-error-subtle/80"
                        : "border-warning-border bg-warning-subtle hover:bg-warning-subtle/80",
                    )}
                  >
                    <AlertTriangle
                      aria-hidden="true"
                      className={cn("mt-0.5 size-4 shrink-0", isDestructive ? "text-error" : "text-warning")}
                    />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-label font-semibold text-foreground">{collectorWarning.label}</span>
                      <span className="text-caption text-foreground-secondary">{collectorWarning.impact}</span>
                      <span className="text-caption text-muted">
                        Os dados voltam a atualizar assim que a coleta normalizar.
                      </span>
                    </div>
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    />
                  </Link>
                ) : (
                  <div
                    className={cn(
                      "flex items-start gap-2.5 rounded-md border p-2.5",
                      isDestructive ? "border-error-border bg-error-subtle" : "border-warning-border bg-warning-subtle",
                    )}
                  >
                    <AlertTriangle
                      aria-hidden="true"
                      className={cn("mt-0.5 size-4 shrink-0", isDestructive ? "text-error" : "text-warning")}
                    />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-label font-semibold text-foreground">{collectorWarning.label}</span>
                      <span className="text-caption text-foreground-secondary">{collectorWarning.impact}</span>
                      <span className="text-caption text-muted">
                        Os dados voltam a atualizar assim que a coleta normalizar.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {unreadTotal > 0 ? (
              <div className="grid gap-2 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-overline text-muted uppercase">Novos alertas</p>
                  <span className="text-caption text-muted tabular-nums">
                    {unreadTotal} {unreadTotal === 1 ? "não lido" : "não lidos"}
                  </span>
                </div>

                <ul role="list" className="grid gap-0.5">
                  {alerts.map((alert) => {
                    const href = alert.trackedLotId ? (`/lotes/${alert.trackedLotId}` as const) : ("/alertas" as const);
                    return (
                      <li key={alert.id} className="flex items-center gap-1">
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          className="group flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-body transition-colors outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent pointer-coarse:min-h-11"
                        >
                          <BellRing aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <span className="line-clamp-1 text-label text-foreground" title={alert.title}>
                              {alert.title}
                            </span>
                            <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted tabular-nums">
                              {alert.watchName ? <span className="truncate">{alert.watchName}</span> : null}
                              {alert.watchName ? (
                                <span aria-hidden="true" className="shrink-0 text-border-strong">
                                  ·
                                </span>
                              ) : null}
                              <time dateTime={alert.createdAt.toISOString()} className="shrink-0">
                                {formatCompactDateTime(alert.createdAt)}
                              </time>
                            </span>
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-muted-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                          />
                        </Link>
                        <button
                          type="button"
                          disabled={isMarkingRead}
                          aria-label={`Marcar alerta “${alert.title}” como lido`}
                          title="Marcar como lido"
                          onClick={() => runMarkRead(() => markAlertReadAction(alert.id))}
                          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors outline-none hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent disabled:opacity-50 pointer-coarse:size-11"
                        >
                          <Check aria-hidden="true" className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href="/alertas"
                    onClick={() => setOpen(false)}
                    className="-mx-2 inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-label font-medium text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent pointer-coarse:min-h-11"
                  >
                    Ver todos os alertas
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </Link>
                  {confirmMarkAll ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isMarkingRead}
                        onClick={() => setConfirmMarkAll(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={isMarkingRead}
                        loadingLabel="Marcando…"
                        onClick={() => {
                          setConfirmMarkAll(false);
                          runMarkRead(() => markAllAlertsReadAction(null));
                        }}
                      >
                        Confirmar ({unreadTotal})
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={isMarkingRead}
                      loadingLabel="Marcando…"
                      onClick={() => {
                        if (unreadTotal > 1) {
                          setConfirmMarkAll(true);
                          return;
                        }
                        runMarkRead(() => markAllAlertsReadAction(null));
                      }}
                    >
                      <CheckCheck aria-hidden="true" />
                      Marcar lidos
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
