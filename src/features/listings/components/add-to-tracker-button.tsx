"use client";

import { ClipboardPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, toast } from "@/components/ui";

import { addListingToTrackerAction } from "../actions";

/** Cria leilão, lote e rascunho a partir do anúncio sem sair da lista; o toast leva ao rascunho (etapa 3). */
export function AddToTrackerButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      className="w-fit"
      loading={isPending}
      loadingLabel="Adicionando…"
      onClick={() =>
        startTransition(async () => {
          const result = await addListingToTrackerAction(listingId);
          if (result.status === "error") {
            toast.error(result.message);
            return;
          }
          const { href } = result;
          toast.success(result.message, { action: { label: "Abrir análise", onClick: () => router.push(href) } });
        })
      }
    >
      <ClipboardPlus aria-hidden="true" />
      Adicionar à análise
    </Button>
  );
}
