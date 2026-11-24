"use client";

import "./globals.css";

import { useEffect } from "react";

/**
 * Último recurso: erro no layout raiz. Substitui o layout inteiro, então define `<html>`/`<body>` e não usa
 * componentes que dependam de providers (checklist de produção do Next).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4">
        <title>Erro · Leilão Tracker</title>
        <main className="grid max-w-md gap-4 text-center">
          <h1 className="text-heading-2 text-foreground">Algo deu errado</h1>
          <p className="text-body text-foreground-secondary">Não foi possível carregar o aplicativo.</p>
          {error.digest ? (
            <p className="text-caption text-muted">
              Código de suporte: <span className="font-mono tabular-nums select-all">{error.digest}</span>. Se
              persistir, informe este código ao administrador.
            </p>
          ) : null}
          <div>
            <button
              type="button"
              onClick={() => retry()}
              className="h-10 rounded-md bg-primary px-4 text-body font-semibold text-surface hover:bg-primary-hover"
            >
              Tentar novamente
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
