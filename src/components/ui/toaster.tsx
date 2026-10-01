"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { toast, Toaster as Sonner } from "sonner";

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
          closeButton:
            "!border-border !bg-surface !text-foreground-secondary hover:!bg-surface-subtle focus:!ring-2 focus:!ring-accent",
        },
      }}
    />
  );
}

export { toast, Toaster };
