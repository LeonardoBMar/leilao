"use client";

import { useEffect, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle, Button, ButtonLink } from "@/components/ui";

export default function PrivateError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid max-w-2xl gap-4">
      <Alert variant="error">
        <AlertTitle>Não foi possível abrir esta tela</AlertTitle>
        <AlertDescription className="grid gap-1.5">
          <p>
            Ocorreu uma falha temporária ao carregar os dados. Tente novamente abaixo ou volte ao Início; seus dados
            salvos não foram alterados.
          </p>
          {error.digest ? (
            <p className="text-caption text-muted">
              Código de suporte: <span className="font-mono tabular-nums select-all">{error.digest}</span>. Se
              persistir, informe este código ao administrador.
            </p>
          ) : null}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={isPending}
          loadingLabel="Tentando…"
          onClick={() => startTransition(() => retry())}
        >
          Tentar novamente
        </Button>
        <ButtonLink href="/dashboard" variant="ghost">
          Voltar ao Início
        </ButtonLink>
      </div>
    </div>
  );
}
