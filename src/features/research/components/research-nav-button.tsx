"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui";

import { useResearchTransition } from "./research-shell";

type ResearchNavButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  href: Route;
};

/**
 * Botão de navegação dentro do Mercado que passa por `useResearchTransition`, ativando o estado de carregamento do
 * `ResearchShell` sem perder a posição de rolagem.
 */
export function ResearchNavButton({ href, type = "button", disabled, ...props }: ResearchNavButtonProps) {
  const router = useRouter();
  const { isPending, startTransition } = useResearchTransition();
  return (
    <Button
      type={type}
      disabled={disabled || isPending}
      aria-busy={isPending}
      onClick={() => {
        startTransition(() => {
          router.push(href, { scroll: false });
        });
      }}
      {...props}
    />
  );
}
