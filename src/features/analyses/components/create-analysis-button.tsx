"use client";

import { useTransition } from "react";

import { Button, type ButtonProps, toast } from "@/components/ui";

import { createAnalysisAction } from "../actions";

type CreateAnalysisButtonProps = Omit<ButtonProps, "onClick" | "loading"> & {
  lotId: string;
  /** Versão fixada cujas premissas serão copiadas (revisão; RF-05). */
  sourceId?: string;
};

/** Abre (ou retoma) o rascunho do lote e navega até ele. */
export function CreateAnalysisButton({ lotId, sourceId, children, ...props }: CreateAnalysisButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      {...props}
      loading={isPending}
      loadingLabel="Abrindo…"
      onClick={() =>
        startTransition(async () => {
          const result = await createAnalysisAction(lotId, sourceId);
          if (result.status === "error") toast.error(result.message);
        })
      }
    >
      {children}
    </Button>
  );
}
