import { Suspense } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import { Skeleton } from "@/components/ui";
import { UnreadAlertsBadge } from "@/features/alerts/components/unread-alerts-badge";
import { UserMenu } from "@/features/auth/components/user-menu";

/**
 * Casca da área privada. Não verifica a sessão aqui (layouts não re-renderizam a cada navegação):
 * a proteção está no proxy (otimista) e em requireUser() na DAL. Só a conta lê a sessão, em <Suspense>.
 */
export default function PrivateLayout({ children }: LayoutProps<"/">) {
  const account = (
    <Suspense fallback={<Skeleton className="h-18" />}>
      <UserMenu />
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

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface p-4 lg:flex">
        <span className="px-3 pt-2 text-body font-semibold tracking-tight text-foreground">Leilão Tracker</span>
        <nav aria-label="Principal" className="flex-1">
          <NavLinks badges={badges} />
        </nav>
        <div className="border-t border-border pt-4">{account}</div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 lg:hidden">
          <MobileNav account={account} badges={badges} />
          <span className="text-body font-semibold tracking-tight text-foreground">Leilão Tracker</span>
        </header>
        <main className="mx-auto w-full max-w-360 px-4 py-6 md:px-6 lg:py-8 xl:px-8">{children}</main>
      </div>
    </div>
  );
}
