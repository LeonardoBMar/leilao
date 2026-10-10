"use client";

import { X } from "lucide-react";
import { useTransition } from "react";

import { Button, toast } from "@/components/ui";

import { setListingDismissedAction } from "../actions";

/** "Dispensar" em "Para analisar agora": tira a sugestão da lista, com "Desfazer" no aviso. */
export function DismissListingButton({ listingId }: { listingId: string }) {
  const [isPending, startTransition] = useTransition();

  function set(dismissed: boolean) {
    startTransition(async () => {
      const result = await setListingDismissedAction(listingId, dismissed);
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.message) {
        toast.success(
          result.message,
          dismissed ? { duration: 8000, action: { label: "Desfazer", onClick: () => set(false) } } : undefined,
        );
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="w-fit"
      loading={isPending}
      loadingLabel="Dispensando…"
      onClick={() => set(true)}
    >
      <X aria-hidden="true" />
      Dispensar
    </Button>
  );
}
