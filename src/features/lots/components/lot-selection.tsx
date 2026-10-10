"use client";

import { Archive, ArchiveRestore, Eye, EyeOff, X } from "lucide-react";
import { createContext, use, useState, useTransition } from "react";

import { Button, Checkbox, toast } from "@/components/ui";

import { bulkLotAction, type BulkLotOperation } from "../actions";

type Selection = {
  ids: readonly string[];
  selected: ReadonlySet<string>;
  toggle: (id: string, checked: boolean) => void;
  setAll: (checked: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

/**
 * Seleção de lotes da página atual para ações em lote (acompanhar, arquivar). Envolve as linhas e a barra; a seleção
 * some ao trocar de página, porque o provedor remonta com a nova lista.
 */
export function LotSelectionProvider({ ids, children }: { ids: readonly string[]; children: React.ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const selection: Selection = {
    ids,
    selected,
    toggle: (id, checked) =>
      setSelected((current) => {
        const next = new Set(current);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      }),
    setAll: (checked) => setSelected(checked ? new Set(ids) : new Set()),
    clear: () => setSelected(new Set()),
  };

  return <SelectionContext value={selection}>{children}</SelectionContext>;
}

function useSelection(): Selection | null {
  return use(SelectionContext);
}

export function LotSelectCheckbox({ lotId, label }: { lotId: string; label: string }) {
  const selection = useSelection();
  if (!selection) return null;
  return (
    <Checkbox
      aria-label={`Selecionar ${label}`}
      checked={selection.selected.has(lotId)}
      onCheckedChange={(checked) => selection.toggle(lotId, checked === true)}
    />
  );
}

export function LotSelectAll() {
  const selection = useSelection();
  if (!selection) return null;
  const count = selection.selected.size;
  const all = count > 0 && count === selection.ids.length;
  return (
    <Checkbox
      aria-label="Selecionar todos os lotes da página"
      checked={all ? true : count > 0 ? "indeterminate" : false}
      onCheckedChange={(checked) => selection.setAll(checked === true)}
    />
  );
}

const OPERATIONS: readonly { operation: BulkLotOperation; label: string; icon: typeof Eye }[] = [
  { operation: "follow", label: "Acompanhar", icon: Eye },
  { operation: "unfollow", label: "Parar de acompanhar", icon: EyeOff },
  { operation: "archive", label: "Arquivar", icon: Archive },
  { operation: "unarchive", label: "Reativar", icon: ArchiveRestore },
];

/** Barra que aparece com lotes selecionados. */
export function LotBulkBar() {
  const selection = useSelection();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState<BulkLotOperation | null>(null);
  if (!selection || selection.selected.size === 0) return null;
  const { selected, clear } = selection;

  function run(operation: BulkLotOperation) {
    setRunning(operation);
    startTransition(async () => {
      const result = await bulkLotAction([...selected], operation);
      if (result.status === "error") toast.error(result.message);
      else {
        if (result.status === "success" && result.message) toast.success(result.message);
        clear();
      }
    });
  }

  return (
    <div
      role="toolbar"
      aria-label="Ações nos lotes selecionados"
      className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-sm lg:top-2"
    >
      <p className="px-2 text-label text-foreground">
        {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
      </p>
      {OPERATIONS.map(({ operation, label, icon: Icon }) => (
        <Button
          key={operation}
          variant="ghost"
          size="sm"
          disabled={isPending}
          loading={isPending && running === operation}
          onClick={() => run(operation)}
        >
          <Icon aria-hidden="true" />
          {label}
        </Button>
      ))}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={clear} disabled={isPending}>
        <X aria-hidden="true" />
        Limpar seleção
      </Button>
    </div>
  );
}
