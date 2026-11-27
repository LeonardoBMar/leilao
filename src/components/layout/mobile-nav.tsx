"use client";

import { CircleHelp, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";

import { Button, Dialog, DialogDescription, DialogTitle, DialogTrigger, DrawerContent } from "@/components/ui";

import { Brand } from "./brand";
import { setGuideDialogOpen } from "./guide-dialog-store";
import { type NavBadges, NavLinks } from "./nav-links";

type MobileNavProps = {
  badges?: NavBadges;
  /** Extras do menu (acompanhados, próximo leilão), renderizados no servidor. */
  followed?: ReactNode;
  nextAuction?: ReactNode;
};

function HideOnDashboard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;
  return <>{children}</>;
}

/**
 * Fecha a gaveta quando o pathname muda (ex.: link nos extras do menu ou navegação programática).
 * Fica em <Suspense> porque `usePathname()` é dado de URL em rotas dinâmicas.
 */
function CloseOnPathnameChange({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  return null;
}

/** Gaveta lateral abaixo de `lg`, com os mesmos destinos e ordem da sidebar (DESIGN.md §9). */
export function MobileNav({ badges, followed, nextAuction }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Suspense fallback={null}>
        <CloseOnPathnameChange onClose={() => setIsOpen(false)} />
      </Suspense>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menu" className="pointer-coarse:size-11">
          <Menu aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DrawerContent side="left" className="gap-5 overflow-y-auto bg-background px-2.5 pt-5 pb-4">
        <div className="pr-10 pl-1.5">
          <DialogTitle asChild>
            <div>
              <Brand />
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Navegação principal</DialogDescription>
        </div>
        <nav aria-label="Principal">
          {/* Fecha ao navegar: com <Activity> a rota anterior fica montada e a gaveta ficaria aberta. */}
          <NavLinks onNavigate={() => setIsOpen(false)} badges={badges} />
        </nav>
        <div className="border-t border-border/70 pt-3">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setGuideDialogOpen(true);
            }}
            className="flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-label font-medium text-foreground-secondary transition-colors outline-none hover:bg-primary-subtle/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent pointer-coarse:h-11"
          >
            <CircleHelp aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-muted-subtle" />
            <span>Guia rápido e atalhos</span>
          </button>
        </div>
        {followed ? (
          <Suspense fallback={followed}>
            <HideOnDashboard>{followed}</HideOnDashboard>
          </Suspense>
        ) : null}
        {nextAuction ? (
          <div className="mt-auto grid grid-cols-1 gap-2.5">
            <Suspense fallback={nextAuction}>
              <HideOnDashboard>{nextAuction}</HideOnDashboard>
            </Suspense>
          </div>
        ) : null}
      </DrawerContent>
    </Dialog>
  );
}
