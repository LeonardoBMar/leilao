import { Suspense } from "react";

import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import { Skeleton } from "@/components/ui";
import { UnreadAlertsBadge } from "@/features/alerts/components/unread-alerts-badge";
import { NextAuctionCard } from "@/features/auctions/components/next-auction-card";
import { UserMenu } from "@/features/auth/components/user-menu";
import { FollowedLotsNav } from "@/features/lots/components/followed-lots-nav";

/**
 * Casca da área privada. Não verifica a sessão aqui (layouts não re-renderizam a cada navegação):
 * a proteção está no proxy (otimista) e em requireUser() na DAL. Conta, contador e extras leem a sessão, em <Suspense>.
 */
export default function PrivateLayout({ children }: LayoutProps<"/">) {
  const account = (
    <Suspense fallback={<Skeleton className="h-10" />}>
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

  return (
    // Direção A (DESIGN.md §9): menu no papel quente, conteúdo num painel branco embutido (no celular, tela cheia).
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[296px_1fr]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-body focus:font-medium focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-accent"
      >
        Pular para o conteúdo
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto px-4 pt-5 pb-4 lg:flex">
        <div className="px-2.5">
          <Brand />
        </div>
        <nav aria-label="Principal">
          <NavLinks badges={badges} />
        </nav>
        {followed}
        <div className="mt-auto grid grid-cols-1 gap-2.5">
          {nextAuction}
          <div className="border-t border-border-strong pt-2.5">{account}</div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col lg:py-2.5 lg:pr-2.5">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4 lg:hidden">
          <MobileNav account={account} badges={badges} followed={followed} nextAuction={nextAuction} />
          <Brand />
        </header>
        <div className="flex-1 bg-surface lg:rounded-lg lg:shadow-sm">
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-360 px-4 py-6 outline-none md:px-6 lg:px-12 lg:pt-7 lg:pb-10"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
