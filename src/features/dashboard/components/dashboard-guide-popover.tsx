"use client";

import { CircleHelp } from "lucide-react";

import { setGuideDialogOpen } from "@/components/layout/guide-dialog-store";
import { Button } from "@/components/ui";

/**
 * Gatilho contextual do guia no painel (Nielsen #10): abre o mesmo `GlobalGuideDialog` com busca de termos e atalhos,
 * garantindo experiência única em toda a aplicação.
 */
export function DashboardGuidePopover() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setGuideDialogOpen(true)}
      aria-label="Como ler este painel e atalhos de teclado"
      aria-haspopup="dialog"
      className="h-10 gap-1.5 px-2 text-caption font-medium text-muted hover:text-foreground sm:h-8 pointer-coarse:h-11"
    >
      <CircleHelp aria-hidden="true" className="size-3.5 shrink-0" />
      <span>Como ler</span>
    </Button>
  );
}
