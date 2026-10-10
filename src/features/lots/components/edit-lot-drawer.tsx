"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DrawerContent,
} from "@/components/ui";

import { updateLotAction } from "../actions";
import type { LotDetail } from "../types";
import { LotForm } from "./lot-form";

/** "Editar" da ficha do lote: o formulário abre numa gaveta lateral, sem sair da ficha. */
export function EditLotDrawer({ lot }: { lot: LotDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      </DialogTrigger>
      <DrawerContent className="max-w-160">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>Editar lote</DialogTitle>
          <DialogDescription>
            Lote {lot.lotNumber} · {lot.auction.name}
          </DialogDescription>
        </DialogHeader>
        {/* Remonta após cada gravação para os campos partirem do valor salvo. */}
        <LotForm
          key={lot.updatedAt.getTime()}
          layout="drawer"
          action={updateLotAction.bind(null, lot.id)}
          lot={lot}
          submitLabel="Salvar alterações"
          onSaved={() => setOpen(false)}
        />
      </DrawerContent>
    </Dialog>
  );
}
