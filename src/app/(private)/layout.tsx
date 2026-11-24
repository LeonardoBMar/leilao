import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui";
import { NotificationsMenu } from "@/features/alerts/components/notifications-menu";
import { UnreadAlertsBadge } from "@/features/alerts/components/unread-alerts-badge";
import { NextAuctionCard } from "@/features/auctions/components/next-auction-card";
import { AdminRoleBridge } from "@/features/auth/components/admin-role-bridge";
import { UserMenu } from "@/features/auth/components/user-menu";
import { FollowedLotsCommandItems } from "@/features/lots/components/followed-lots-command-items";
import { FollowedLotsNav } from "@/features/lots/components/followed-lots-nav";

/**
 * Casca da área privada. Não verifica a sessão aqui (layouts não re-renderizam a cada navegação):
 * a proteção está no proxy (otimista) e em requireUser() na DAL. Conta, notificações, contador e extras leem a sessão, em <Suspense>.
 */
export default function PrivateLayout({ children }: LayoutProps<"/">) {
  const account = (
    <Suspense fallback={<Skeleton className="size-10 rounded-full sm:size-8 pointer-coarse:size-10" />}>
      <UserMenu variant="header" />
    </Suspense>
  );
  const sidebarAccount = (
    <Suspense fallback={<Skeleton className="h-10 w-full rounded-md" />}>
      <UserMenu variant="sidebar" />
    </Suspense>
  );
  const notifications = (
    <Suspense fallback={<Skeleton className="size-10 rounded-md sm:size-8 pointer-coarse:size-10" />}>
      <NotificationsMenu />
    </Suspense>
  );
  // Contador lê a sessão: fica em <Suspense> e some enquanto carrega (a navegação não espera por ele).
  const badges = {
    "/alertas": (
      <Suspense fallback={null}>
        <UnreadAlertsBadge />
      </Suspense>
    ),
  } as const;
  // Extras do menu (DESIGN.md §9): somem enquanto carregam e quando não há o que mostrar.
  const followed = (
    <Suspense fallback={null}>
      <FollowedLotsNav />
    </Suspense>
  );
  const nextAuction = (
    <Suspense fallback={null}>
      <NextAuctionCard />
    </Suspense>
  );
  const commandItems = (
    <>
      <Suspense fallback={null}>
        <AdminRoleBridge />
      </Suspense>
      <Suspense fallback={null}>
        <FollowedLotsCommandItems />
      </Suspense>
    </>
  );

  return (
    <AppShell
      account={account}
      sidebarAccount={sidebarAccount}
      notifications={notifications}
      badges={badges}
      followed={followed}
      nextAuction={nextAuction}
      commandItems={commandItems}
    >
      {children}
    </AppShell>
  );
}
