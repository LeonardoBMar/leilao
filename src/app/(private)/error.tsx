"use client";

import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle, Button } from "@/components/ui";

export default function PrivateError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid max-w-2xl gap-4">
      <Alert variant="error">
        <AlertTitle>Algo deu errado</AlertTitle>
        <AlertDescription className="grid gap-1.5">
          <p>Não foi possível carregar esta página.</p>
          {error.digest ? (
            <p className="text-caption text-muted">
              Código de suporte: <span className="font-mono tabular-nums select-all">{error.digest}</span>. Se
              persistir, informe este código ao administrador.
            </p>
          ) : null}
        </AlertDescription>
      </Alert>
      <div>
        <Button variant="secondary" onClick={() => retry()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
