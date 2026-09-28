import { countUnreadAlerts } from "../queries";

/** Contador de não lidos ao lado de "Alertas" na navegação. Lê a sessão: renderizar dentro de <Suspense>. */
export async function UnreadAlertsBadge() {
  const unread = await countUnreadAlerts();
  if (unread === 0) return null;
  return (
    <span className="text-primary-foreground ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-caption font-semibold tabular-nums">
      {unread > 99 ? "99+" : unread}
      <span className="sr-only"> não lidos</span>
    </span>
  );
}
