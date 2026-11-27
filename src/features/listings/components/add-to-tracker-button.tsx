"use client";

import { ArrowRight, ClipboardPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, type ButtonProps, toast } from "@/components/ui";

import { addListingToTrackerAction } from "../actions";

type AddToTrackerButtonProps = {
  listingId: string;
  /** `"stay"` (padrão) adiciona sem sair da lista; `"open"` já abre o rascunho criado. */
  mode?: "stay" | "open";
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onAdded?: () => void;
};

/** Cria leilão, lote e rascunho a partir do anúncio: fica na lista ou abre direto o rascunho (etapa 3). */
export function AddToTrackerButton({
  listingId,
  mode = "stay",
  label,
  variant,
  size = "sm",
  className = "w-fit",
  disabled = false,
  onPendingChange,
  onAdded,
}: AddToTrackerButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isOpenMode = mode === "open";
  const resolvedVariant = variant ?? (isOpenMode ? "primary" : "secondary");
  const resolvedLabel = label ?? (isOpenMode ? "Analisar agora" : "Adicionar à análise");

  return (
    <Button
      size={size}
      variant={resolvedVariant}
      className={className}
      disabled={disabled}
      loading={isPending}
      loadingLabel={isOpenMode ? "Abrindo…" : "Adicionando…"}
      onClick={() => {
        if (disabled || isPending) return;
        onPendingChange?.(true);
        startTransition(async () => {
          let navigating = false;
          try {
            const result = await addListingToTrackerAction(listingId);
            if (result.status !== "success") {
              if (result.status === "error") toast.error(result.message);
              return;
            }
            onAdded?.();
            const { href } = result.data;
            if (isOpenMode) {
              navigating = true;
              router.push(href);
              return;
            }
            toast.success(result.message, { action: { label: "Abrir análise", onClick: () => router.push(href) } });
          } catch {
            toast.error("Não foi possível concluir a ação. Tente novamente.");
          } finally {
            if (!navigating) onPendingChange?.(false);
          }
        });
      }}
    >
      {isOpenMode ? (
        <>
          {resolvedLabel}
          <ArrowRight aria-hidden="true" />
        </>
      ) : (
        <>
          <ClipboardPlus aria-hidden="true" />
          {resolvedLabel}
        </>
      )}
    </Button>
  );
}
