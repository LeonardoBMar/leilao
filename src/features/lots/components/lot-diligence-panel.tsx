"use client";

import { ClipboardCheck, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge, Checkbox, Section, SectionHeader, SectionTitle, toast } from "@/components/ui";
import {
  DILIGENCE_ITEMS,
  type DiligenceChecklist,
  type DiligenceKey,
  plateLookupLinks,
  summarizeDiligence,
} from "@/domain/lots/diligence";

import { toggleDiligenceItemAction } from "../actions";

type LotDiligencePanelProps = {
  lotId: string;
  initial: DiligenceChecklist;
  privatePlate: string | null;
};

/** Checklist de diligência pré-lance na ficha do lote (D-97). */
export function LotDiligencePanel({ lotId, initial, privatePlate }: LotDiligencePanelProps) {
  const [checklist, setChecklist] = useState<DiligenceChecklist>(initial);
  const [isPending, startTransition] = useTransition();

  const summary = summarizeDiligence(checklist);
  const plateLinks = plateLookupLinks(privatePlate);

  function handleToggle(key: DiligenceKey, nextChecked: boolean) {
    const previous = checklist;
    setChecklist({
      items: { ...checklist.items, [key]: nextChecked },
      updatedAt: new Date().toISOString(),
    });
    startTransition(async () => {
      const result = await toggleDiligenceItemAction(lotId, key, nextChecked);
      if (result.status === "error") {
        setChecklist(previous);
        toast.error(result.message);
      }
    });
  }

  return (
    <Section id="diligencia" className="grid gap-4 border-t border-border pt-7">
      <SectionHeader>
        <div className="flex flex-wrap items-center gap-2.5">
          <SectionTitle className="flex items-center gap-2">
            <ClipboardCheck aria-hidden="true" className="size-4 shrink-0 text-muted" />
            Checklist de diligência pré-lance
          </SectionTitle>
          <Badge variant={summary.isComplete ? "success" : "outline"} className="tabular-nums">
            {summary.completed} de {summary.total} verificados
          </Badge>
        </div>
      </SectionHeader>

      <div className="grid gap-1.5 rounded-lg border border-border bg-surface p-3.5">
        {DILIGENCE_ITEMS.map((item) => {
          const checked = checklist.items[item.key];
          return (
            <div key={item.key} className="flex items-center justify-between gap-3">
              <Checkbox
                checked={checked}
                disabled={isPending}
                onCheckedChange={(value) => handleToggle(item.key, value === true)}
                label={<span className={checked ? "text-muted line-through" : "text-foreground"}>{item.label}</span>}
              />
              {item.critical && !checked ? (
                <Badge variant="warning" className="shrink-0">
                  Crítico
                </Badge>
              ) : null}
            </div>
          );
        })}
      </div>

      {plateLinks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-background px-3.5 py-2.5 text-caption">
          <span className="font-medium text-foreground">Consultas públicas pela placa:</span>
          {plateLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={link.description}
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              {link.label}
              <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
