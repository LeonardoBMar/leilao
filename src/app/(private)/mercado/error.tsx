"use client";

import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle, Button, ButtonLink } from "@/components/ui";

export default function MarketError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid max-w-2xl gap-4">
      <Alert variant="error">
        <AlertTitle>Não foi possível carregar o Mercado</AlertTitle>
        <AlertDescription>
          A consulta ao catálogo falhou. Tente novamente ou volte para o início do Mercado com os filtros limpos.
          {error.digest ? ` Código: ${error.digest}` : null}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => retry()}>
          Tentar novamente
        </Button>
        <ButtonLink href="/mercado" variant="ghost">
          Voltar ao início do Mercado
        </ButtonLink>
      </div>
    </div>
  );
}
