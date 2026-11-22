"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type ComponentProps, useState } from "react";

import { Button } from "@/components/ui";

import { useResearchTransition } from "./research-shell";

type ResearchNavButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  href: Route;
  /** Id de elemento estável para receber o foco após a navegação (quando o próprio botão some do DOM). */
  focusTargetId?: string;
};

/**
 * Botão de navegação dentro do Mercado que passa por `useResearchTransition`, ativando o estado de carregamento do
 * `ResearchShell` sem perder a posição de rolagem e marcando `aria-busy` apenas no botão acionado.
 */
export function ResearchNavButton({ href, focusTargetId, type = "button", ...props }: ResearchNavButtonProps) {
  const router = useRouter();
  const { isPending, startTransition } = useResearchTransition();
  const [active, setActive] = useState(false);
  if (!isPending && active) setActive(false);

  return (
    <Button
      type={type}
      aria-busy={isPending && active ? true : undefined}
      onClick={() => {
        setActive(true);
        startTransition(() => {
          router.push(href, { scroll: false });
        });
        if (focusTargetId) {
          document.getElementById(focusTargetId)?.focus();
        }
      }}
      {...props}
    />
  );
}
