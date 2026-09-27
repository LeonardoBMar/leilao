"use client";

import { Menu } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui";

import { NavLinks } from "./nav-links";

type MobileNavProps = {
  /** Conta/sair, renderizado no servidor. */
  account: ReactNode;
};

/** Gaveta lateral abaixo de `lg`, com os mesmos destinos e ordem da sidebar (DESIGN.md §9). */
export function MobileNav({ account }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menu">
          <Menu aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="top-0 left-0 flex h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 scale-100 flex-col gap-6 rounded-none border-y-0 border-l-0 p-4 data-[state=open]:scale-100">
        <div className="pr-10">
          <DialogTitle className="text-body font-semibold">Leilão Tracker</DialogTitle>
          <DialogDescription className="sr-only">Navegação principal</DialogDescription>
        </div>
        <nav aria-label="Principal" className="flex-1">
          {/* Fecha ao navegar: com <Activity> a rota anterior fica montada e a gaveta ficaria aberta. */}
          <NavLinks onNavigate={() => setIsOpen(false)} />
        </nav>
        <div className="border-t border-border pt-4">{account}</div>
      </DialogContent>
    </Dialog>
  );
}
