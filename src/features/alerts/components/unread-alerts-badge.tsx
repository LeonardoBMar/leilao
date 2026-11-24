import { countUnreadAlerts } from "../queries";

/** Contador de não lidos ao lado de "Alertas" na navegação. Lê a sessão: renderizar dentro de <Suspense>. */
export async function UnreadAlertsBadge() {
  const unread = await countUnreadAlerts();
  if (unread === 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-semibold text-white tabular-nums [[data-collapsed=true]>&]:ml-0 [[data-collapsed=true]>&]:size-2 [[data-collapsed=true]>&]:min-w-0 [[data-collapsed=true]>&]:p-0">
      <span className="[[data-collapsed=true]_&]:sr-only">{unread > 99 ? "99+" : unread}</span>
      <span className="sr-only"> não lidos</span>
    </span>
  );
}
