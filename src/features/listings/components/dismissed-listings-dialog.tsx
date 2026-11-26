"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import { setListingDismissedAction } from "../actions";
import type { DismissedSuggestion } from "../types";

/** Permite rever e restaurar sugestões abertas dispensadas de "Para analisar agora" (D-56). */
export function DismissedListingsDialog({ items }: { items: readonly DismissedSuggestion[] }) {
  const [open, setOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  function restore(listingId: string) {
    setRestoringId(listingId);
    startTransition(async () => {
      const result = await setListingDismissedAction(listingId, false);
      setRestoringId(null);
      if (result.status === "error") {
        toast.error(result.message);
      } else {
        if (result.status === "success" && result.message) toast.success(result.message);
        if (items.length <= 1) setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-fit text-muted hover:text-foreground">
          <RotateCcw aria-hidden="true" className="size-3.5" />
          {items.length === 1 ? "1 dispensado" : `${items.length} dispensados`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sugestões dispensadas</DialogTitle>
          <DialogDescription>
            Anúncios abertos que você tirou de &ldquo;Para analisar agora&rdquo;. Restaurar devolve a sugestão à lista.
          </DialogDescription>
        </DialogHeader>
        <ul role="list" className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle/50 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-foreground">{item.title}</p>
                <p className="text-caption text-muted tabular-nums">
                  {item.sourceName}
                  {item.endsAt ? ` · Encerra ${formatDateTime(item.endsAt)}` : ""}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                loading={isPending && restoringId === item.id}
                onClick={() => restore(item.id)}
              >
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
