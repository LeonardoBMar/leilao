"use client";

import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { useIsMac } from "./use-is-mac";

type GlossaryContentProps = {
  onNavigate?: () => void;
};

/**
 * Glossário único de conceitos financeiros e atalhos de teclado, reutilizado no popover do dashboard e no diálogo
 * global da conta/paleta de comandos para evitar divergência de conteúdo.
 */
export function GlossaryContent({ onNavigate }: GlossaryContentProps) {
  const isMac = useIsMac();

  return (
    <>
      <dl className="grid gap-3 text-caption">
        <div className="grid gap-0.5">
          <dt className="font-semibold text-foreground">Preço provável</dt>
          <dd className="text-foreground-secondary">
            Mediana dos arremates comparáveis do mesmo modelo no catálogo, sempre acompanhada do tamanho da base (n).
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-semibold text-foreground">Limite estimado e premissas padrão</dt>
          <dd className="text-foreground-secondary">
            Lance máximo calculado a partir das suas análises anteriores ou das premissas padrão de margem, guincho e
            custos configuradas em Preferências.
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-semibold text-foreground">Monitores e região-base</dt>
          <dd className="text-foreground-secondary">
            Sua região-base define o raio padrão do catálogo; monitores são buscas salvas que avisam quando surgem novos
            lotes compatíveis.
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-semibold text-foreground">Fixar análise e versões (v1, v2)</dt>
          <dd className="text-foreground-secondary">
            Análises fixadas antes do leilão ficam imutáveis para preservar sua disciplina; cada ajuste posterior gera
            uma nova versão.
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-semibold text-foreground">Resultados comparáveis e calibração</dt>
          <dd className="text-foreground-secondary">
            Lotes com análise fixada antes do leilão e resultado registrado, usados para acompanhar a precisão dos seus
            limites.
          </dd>
        </div>
      </dl>

      <div className="grid gap-2 border-t border-border pt-3 text-caption">
        <p className="font-mono text-overline font-medium text-muted uppercase">Atalhos de teclado</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-foreground-secondary">
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
          <span>
            <kbd className="rounded-sm border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-caption text-foreground">
              ?
            </kbd>{" "}
            guia rápido
          </span>
        </div>
        <Link
          href="/sistema/preferencias"
          onClick={onNavigate}
          className="mt-1 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent pointer-coarse:min-h-11"
        >
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          Ajustar premissas padrão e região-base
        </Link>
      </div>
    </>
  );
}
