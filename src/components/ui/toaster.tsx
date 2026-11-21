"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { type ExternalToast, toast as sonnerToast, Toaster as Sonner } from "sonner";

type ToastMessage = Parameters<typeof sonnerToast>[0];

function withAccessibleDuration(data: ExternalToast | undefined, forcePersistent: boolean): ExternalToast | undefined {
  if (data?.duration !== undefined) return data;
  if (forcePersistent || data?.action) return { ...data, duration: Infinity };
  return data;
}

/**
 * Wrapper acessível sobre o `toast` do Sonner (WCAG 2.2.1/2.2.2):
 * toasts de erro ou que contenham ação (`action`) permanecem abertos (`duration: Infinity`)
 * até o usuário agir ou dispensá-los, salvo se `duration` for passado explicitamente.
 */
const toast = Object.assign(
  (message: ToastMessage, data?: ExternalToast) => sonnerToast(message, withAccessibleDuration(data, false)),
  {
    success: (message: ToastMessage, data?: ExternalToast) =>
      sonnerToast.success(message, withAccessibleDuration(data, false)),
    info: (message: ToastMessage, data?: ExternalToast) =>
      sonnerToast.info(message, withAccessibleDuration(data, false)),
    warning: (message: ToastMessage, data?: ExternalToast) =>
      sonnerToast.warning(message, withAccessibleDuration(data, false)),
    error: (message: ToastMessage, data?: ExternalToast) =>
      sonnerToast.error(message, withAccessibleDuration(data, true)),
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    dismiss: sonnerToast.dismiss,
    message: (message: ToastMessage, data?: ExternalToast) =>
      sonnerToast.message(message, withAccessibleDuration(data, false)),
    custom: sonnerToast.custom,
  },
);

function Toaster() {
  return (
    <Sonner
      closeButton
      duration={5000}
      icons={{
        success: <CircleCheck aria-hidden="true" className="size-5 text-success" />,
        info: <Info aria-hidden="true" className="size-5 text-info" />,
        warning: <TriangleAlert aria-hidden="true" className="size-5 text-warning" />,
        error: <CircleAlert aria-hidden="true" className="size-5 text-error" />,
        loading: <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-muted" />,
        close: <X aria-hidden="true" className="size-4" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border-border !bg-surface-elevated !text-foreground !shadow-md",
          title: "!text-body !font-semibold",
          description: "!text-body !text-foreground-secondary",
          actionButton: "!bg-primary !text-white !font-semibold hover:!bg-primary-hover",
          closeButton:
            "!border-border !bg-surface !text-foreground-secondary hover:!bg-surface-subtle focus-visible:!ring-2 focus-visible:!ring-accent focus-visible:!outline-2 focus-visible:!outline-transparent",
        },
      }}
    />
  );
}

export { toast, Toaster };
