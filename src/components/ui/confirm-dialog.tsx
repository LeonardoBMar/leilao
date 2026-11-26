"use client";

import type { ReactNode } from "react";

import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

export type ConfirmDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  variant?: "destructive" | "primary";
  /** Fecha o diálogo imediatamente ao clicar em confirmar (útil em diálogos não controlados). */
  closeOnConfirm?: boolean;
  trigger?: ReactNode;
  onConfirm: () => void;
};

/** Diálogo de confirmação reutilizável para exclusões e ações irreversíveis. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  loading = false,
  loadingLabel,
  variant = "destructive",
  closeOnConfirm = false,
  trigger,
  onConfirm,
}: ConfirmDialogProps) {
  const confirmButton = (
    <Button variant={variant} loading={loading} loadingLabel={loadingLabel} onClick={onConfirm}>
      {confirmLabel}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{cancelLabel}</Button>
          </DialogClose>
          {closeOnConfirm ? <DialogClose asChild>{confirmButton}</DialogClose> : confirmButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
