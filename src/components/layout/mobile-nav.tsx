"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";

import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui";

import { Brand } from "./brand";
import { type NavBadges, NavLinks } from "./nav-links";

type MobileNavProps = {
  /** Conta/sair, renderizado no servidor. */
  account: ReactNode;
  badges?: NavBadges;
  /** Extras do menu (acompanhados, próximo leilão), renderizados no servidor. */
  followed?: ReactNode;
  nextAuction?: ReactNode;
};

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
export function MobileNav({ account, badges, followed, nextAuction }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Suspense fallback={null}>
        <CloseOnPathnameChange onClose={() => setIsOpen(false)} />
      </Suspense>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menu">
          <Menu aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="top-0 left-0 flex h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 scale-100 flex-col gap-6 overflow-y-auto rounded-none border-y-0 border-l-0 bg-background p-4 data-[state=open]:scale-100">
        <div className="pr-10">
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
        {followed}
        <div className="mt-auto grid grid-cols-1 gap-2.5">
          {nextAuction}
          <div className="border-t border-border-strong pt-2.5">{account}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
