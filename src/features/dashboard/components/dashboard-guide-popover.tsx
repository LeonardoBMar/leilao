"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { GlossaryContent } from "@/components/layout/glossary-content";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

/**
 * Glossário contextual e referência de atalhos do painel (Nielsen #10): mantém a superfície limpa e entrega
 * definição imediata dos termos financeiros e atalhos sem tirar o usuário do fluxo.
 */
export function DashboardGuidePopover() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Como ler este painel e atalhos de teclado"
          className="h-8 gap-1.5 px-2 text-caption font-medium text-muted hover:text-foreground pointer-coarse:h-11"
        >
          <CircleHelp aria-hidden="true" className="size-3.5 shrink-0" />
          <span>Como ler</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Guia rápido do painel" className="w-88 gap-0 p-0 sm:w-96">
        <div className="border-b border-border px-4 py-3">
          <p className="text-label font-semibold text-foreground">Como ler este painel</p>
          <p className="mt-0.5 text-caption text-muted">
            Os números combinam histórico do catálogo com suas premissas de custo e margem.
          </p>
        </div>

        <div className="grid gap-3 px-4 py-3.5">
          <GlossaryContent onNavigate={() => setOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
