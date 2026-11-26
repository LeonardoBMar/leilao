"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogPortal(props: DialogPrimitive.DialogPortalProps) {
  return <DialogPrimitive.Portal {...props} />;
}

type DialogOverlayProps = DialogPrimitive.DialogOverlayProps & {
  instant?: boolean;
};

function DialogOverlay({ className, instant = false, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 overflow-hidden overscroll-contain bg-[var(--overlay)]",
        instant
          ? "opacity-100 transition-none duration-0"
          : "opacity-0 transition-opacity duration-200 ease-[var(--ease-out)] data-[state=open]:opacity-100 motion-reduce:transition-none starting:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

type DialogContentProps = DialogPrimitive.DialogContentProps & {
  /** Oculta o botão de fechar no canto superior direito (ex.: paleta de comando com Escape). */
  hideClose?: boolean;
  /** Desliga a transição de entrada do overlay e do conteúdo (ex.: paleta de comando instantânea). */
  instant?: boolean;
};

function DialogContent({ className, children, hideClose = false, instant = false, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay instant={instant} />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-120 -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-elevated p-5 shadow-lg outline-none md:p-6",
          instant
            ? "scale-100 opacity-100 transition-none duration-0"
            : "scale-[0.98] opacity-0 transition-[opacity,transform] duration-200 ease-[var(--ease-out)] data-[state=open]:scale-100 data-[state=open]:opacity-100 motion-reduce:transition-none starting:scale-[0.98] starting:opacity-0",
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose ? (
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="absolute top-3.5 right-3.5 flex size-10 items-center justify-center rounded-md text-muted transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97] sm:size-9 pointer-coarse:size-11"
          >
            <X aria-hidden="true" className="size-4.5" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

type DrawerContentProps = DialogPrimitive.DialogContentProps & {
  /** `left`/`right`: painel lateral. `bottom`: gaveta inferior (celular), até 85% da altura. `responsive`: inferior no celular e lateral a partir de `md`. */
  side?: "left" | "right" | "bottom" | "responsive";
};

/**
 * Gaveta (DESIGN.md §5.8): o mesmo Dialog do Radix (foco preso, Escape, volta do foco), presa a uma borda. O corpo
 * rola e o rodapé (`DrawerFooter`) fica fixo. Use `DialogHeader`/`DialogTitle` dentro.
 */
function DrawerContent({ className, children, side = "right", ...props }: DrawerContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col overscroll-contain bg-surface-elevated shadow-lg transition-transform duration-280 ease-[var(--ease-drawer)] outline-none motion-reduce:transition-none",
          side === "left" &&
            "inset-y-0 left-0 w-74 max-w-[85dvw] -translate-x-full border-r border-border data-[state=open]:translate-x-0 starting:-translate-x-full",
          side === "right" &&
            "inset-y-0 right-0 w-full max-w-110 translate-x-full border-l border-border data-[state=open]:translate-x-0 starting:translate-x-full",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85dvh] translate-y-full rounded-t-xl border-t border-border data-[state=open]:translate-y-0 starting:translate-y-full",
          side === "responsive" &&
            "inset-x-0 bottom-0 max-h-[85dvh] translate-y-full rounded-t-xl border-t border-border data-[state=open]:translate-y-0 md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-full md:max-w-110 md:translate-x-full md:translate-y-0 md:rounded-none md:border-t-0 md:border-l md:data-[state=open]:translate-x-0 starting:translate-y-full md:starting:translate-x-full md:starting:translate-y-0",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute top-3.5 right-3.5 flex size-10 items-center justify-center rounded-md text-muted transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97] sm:size-9 pointer-coarse:size-11"
        >
          <X aria-hidden="true" className="size-4.5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/** Corpo rolável da gaveta. */
function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 content-start gap-7 overflow-y-auto overscroll-contain px-5 py-5 md:px-6",
        className,
      )}
      {...props}
    />
  );
}

/** Rodapé fixo da gaveta: secundária e principal, como no Dialog. */
function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex gap-3 border-t border-border px-5 py-4 empty:hidden md:justify-end md:px-6 [&>*]:flex-1 md:[&>*]:flex-none",
        className,
      )}
      {...props}
    />
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-2 pr-10", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-3 border-t border-border pt-5 md:flex-row md:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return <DialogPrimitive.Title className={cn("text-heading-2 text-foreground", className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) {
  return <DialogPrimitive.Description className={cn("text-body text-foreground-secondary", className)} {...props} />;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
};
