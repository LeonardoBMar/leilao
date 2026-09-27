"use client";

import { useRouter } from "next/navigation";
import { Fragment } from "react";

/**
 * Recomeça o conteúdo a cada navegação nova (link, push ou replace) e o mantém no voltar/avançar do navegador.
 * Com Cache Components, o Next esconde a página anterior em vez de desmontá-la, e um formulário de cadastro
 * voltaria com o que foi digitado da última vez (D-24). Para formulários de edição, prefira `key` derivada do dado.
 */
export function FreshOnNavigation({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
