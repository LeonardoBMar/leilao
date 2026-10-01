import { Suspense } from "react";

import { Brand } from "@/components/layout/brand";
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
    // Direção A (DESIGN.md §9): menu no papel quente, conteúdo num painel branco embutido (no celular, tela cheia).
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-7 px-3 pt-4 pb-3 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav aria-label="Principal" className="flex-1">
          <NavLinks badges={badges} />
        </nav>
        <div className="border-t border-border-strong pt-3">{account}</div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col lg:py-2.5 lg:pr-2.5">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4 lg:hidden">
          <MobileNav account={account} badges={badges} />
          <Brand />
        </header>
        <div className="flex-1 bg-surface lg:rounded-lg lg:shadow-sm">
          <main className="mx-auto w-full max-w-360 px-4 py-6 md:px-6 lg:px-12 lg:pt-7 lg:pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
