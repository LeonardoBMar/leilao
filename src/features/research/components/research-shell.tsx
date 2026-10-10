"use client";

import { createContext, type ReactNode, type TransitionStartFunction, useContext, useTransition } from "react";

import { cn } from "@/lib/utils";

type ResearchTransition = { isPending: boolean; startTransition: TransitionStartFunction };

const ResearchTransitionContext = createContext<ResearchTransition | null>(null);

/** A transição que aplica os filtros: a barra a inicia e a casca dos blocos lê se ela está em andamento. */
export function useResearchTransition(): ResearchTransition {
  const transition = useContext(ResearchTransitionContext);
  if (transition === null) throw new Error("useResearchTransition fora da ResearchShell");
  return transition;
}

/**
 * Casca da Pesquisa: enquanto os filtros novos carregam, os blocos continuam na tela com os números antigos. Para não
 * passarem por atuais, ficam esmaecidos e marcados como ocupados até a resposta chegar (DESIGN.md §15.8).
 */
export function ResearchShell({ filterBar, children }: { filterBar: ReactNode; children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <ResearchTransitionContext value={{ isPending, startTransition }}>
      <div className="grid gap-6">
        {filterBar}
        <div
          aria-busy={isPending}
          className={cn("grid gap-6 transition-opacity duration-120", isPending && "opacity-50")}
        >
          {children}
        </div>
      </div>
    </ResearchTransitionContext>
  );
}
