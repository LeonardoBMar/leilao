"use client";

import { useSyncExternalStore } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui";

import { GlossaryContent } from "./glossary-content";
import {
  getGuideDialogServerSnapshot,
  getGuideDialogSnapshot,
  setGuideDialogOpen,
  subscribeGuideDialog,
} from "./guide-dialog-store";

/** Diálogo global "Guia rápido e atalhos", acessível pelo menu da conta, pelo ⌘K ou pela tecla `?`. */
export function GlobalGuideDialog() {
  const open = useSyncExternalStore(subscribeGuideDialog, getGuideDialogSnapshot, getGuideDialogServerSnapshot);

  return (
    <Dialog open={open} onOpenChange={setGuideDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Guia rápido e atalhos</DialogTitle>
          <DialogDescription>
            Conceitos financeiros e atalhos de teclado disponíveis em todas as telas do Leilão Tracker.
          </DialogDescription>
        </DialogHeader>
        <GlossaryContent onNavigate={() => setGuideDialogOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
