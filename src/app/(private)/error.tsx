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
        <AlertDescription>Não foi possível carregar esta página.</AlertDescription>
      </Alert>
      <div>
        <Button variant="secondary" onClick={() => retry()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
