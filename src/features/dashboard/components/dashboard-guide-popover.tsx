"use client";

import { CircleHelp, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useIsMac } from "@/components/layout/use-is-mac";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

/**
 * Glossário contextual e referência de atalhos do painel (Nielsen #10): mantém a superfície limpa e entrega
 * definição imediata dos termos financeiros e atalhos sem tirar o usuário do fluxo.
 */
export function DashboardGuidePopover() {
  const [open, setOpen] = useState(false);
  const isMac = useIsMac();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Como ler este painel e atalhos de teclado"
          className="h-8 gap-1.5 px-2 text-caption font-medium text-muted hover:text-foreground pointer-coarse:h-10"
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

        <dl className="grid gap-3 px-4 py-3.5 text-caption">
          <div className="grid gap-0.5">
            <dt className="font-semibold text-foreground">Preço provável</dt>
            <dd className="text-foreground-secondary">
              Mediana dos arremates comparáveis do mesmo modelo no catálogo, sempre exibida com o tamanho da base (n).
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="font-semibold text-foreground">Limite estimado e premissas padrão</dt>
            <dd className="text-foreground-secondary">
              Lance máximo calculado a partir das suas análises anteriores ou das premissas padrão de margem, guincho e
              custos.
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="font-semibold text-foreground">Resultados comparáveis e calibração</dt>
            <dd className="text-foreground-secondary">
              Lotes cuja análise foi fixada antes do leilão e que já têm resultado registrado, para medir a precisão dos
              seus limites.
            </dd>
          </div>
        </dl>

        <div className="grid gap-2 border-t border-border bg-background px-4 py-3 text-caption">
          <p className="font-mono text-overline font-medium text-muted uppercase">Atalhos</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground-secondary">
            <span>
              <kbd className="rounded-sm border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-caption text-foreground">
                {isMac ? "⌘K" : "Ctrl+K"}
              </kbd>{" "}
              busca rápida
            </span>
            <span>
              <kbd className="rounded-sm border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-caption text-foreground">
                {isMac ? "⌘B" : "Ctrl+B"}
              </kbd>{" "}
              barra lateral
            </span>
          </div>
          <Link
            href="/sistema/preferencias"
            onClick={() => setOpen(false)}
            className="mt-1 inline-flex min-h-9 w-fit items-center gap-1.5 rounded-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent"
          >
            <SlidersHorizontal aria-hidden="true" className="size-3.5" />
            Ajustar premissas padrão e região-base
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
