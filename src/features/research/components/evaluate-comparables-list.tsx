"use client";

import { Car, ChevronDown, ExternalLink, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef } from "react";

import { Badge, Button } from "@/components/ui";
import type { EstimateConfidence, SimilarityReason } from "@/domain/listings/estimates";
import type { VehicleOrigin } from "@/domain/listings/origin";
import { cents } from "@/domain/money";
import type { EvaluateFilters } from "@/domain/research/evaluate";
import { ORIGIN_LABELS } from "@/features/listings/filter-labels";
import { formatCompactBRL, formatDate, formatKm, formatRatio } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CONFIDENCE_SHORT_LABELS, salesLabel, SIMILARITY_LABELS } from "../labels";
import { evaluateHref } from "../search";
import { useResearchTransition } from "./research-shell";

/** Linhas abertas de início; o resto fica em "Ver as outras". */
const SHOWN = 12;

export type SerializableComparable = {
  id: string;
  url: string;
  title: string;
  endsAtMs: number;
  modelYear: number | null;
  mileageKm: number | null;
  origin: VehicleOrigin | null;
  city: string | null;
  state: string | null;
  source: string;
  photoUrl: string | null;
  finalBidCents: number;
  marketValueCents: number | null;
  reasons: readonly SimilarityReason[];
};

export type SerializableAnswer =
  | {
      kind: "band";
      lowCents: number;
      medianCents: number;
      highCents: number;
      marketRatio: number | null;
      n: number;
      confidence: EstimateConfidence;
    }
  | { kind: "few"; n: number; needed: number };

/**
 * Lista interativa de comparáveis com fila otimista de exclusões: cliques rápidos em "Tirar da conta" acumulam sobre
 * o último estado pendente em vez de sobrescrever a URL com a prop atrasada do servidor.
 */
export function EvaluateComparablesList({
  items,
  filters,
  answer,
}: {
  items: readonly SerializableComparable[];
  filters: EvaluateFilters;
  answer: SerializableAnswer;
}) {
  const router = useRouter();
  const { isPending, startTransition } = useResearchTransition();
  const [optimisticExcluded, setOptimisticExcluded] = useOptimistic(filters.excluded);
  const latestExcludedRef = useRef<readonly string[]>(filters.excluded);
  useEffect(() => {
    if (!isPending) latestExcludedRef.current = filters.excluded;
  }, [filters.excluded, isPending]);

  const excludedSet = new Set(optimisticExcluded);
  const excludedCount = optimisticExcluded.length;

  function commitExcluded(next: readonly string[], { focusHeading = false } = {}) {
    latestExcludedRef.current = next;
    startTransition(() => {
      setOptimisticExcluded([...next]);
      router.push(evaluateHref({ ...filters, excluded: [...next] }), { scroll: false });
    });
    if (focusHeading) {
      document.getElementById("comparaveis-titulo")?.focus();
    }
  }

  function toggleSale(id: string) {
    const current = latestExcludedRef.current;
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    commitExcluded(next);
  }

  const shown = items.slice(0, SHOWN);
  const rest = items.slice(SHOWN);

  return (
    <>
      <p role="status" className="sr-only">
        {excludedCount > 0
          ? answer.kind === "band"
            ? `${salesLabel(excludedCount)} fora da conta. Faixa recalculada: ${formatCompactBRL(cents(answer.lowCents))} a ${formatCompactBRL(cents(answer.highCents))}, confiança ${CONFIDENCE_SHORT_LABELS[answer.confidence]}.`
            : `${salesLabel(excludedCount)} fora da conta. Restam ${salesLabel(answer.n)} na conta.`
          : `Todas as ${salesLabel(items.length)} estão na conta.`}
      </p>
      <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
        {shown.map((item) => (
          <ComparableRow key={item.id} item={item} excluded={excludedSet.has(item.id)} onToggle={toggleSale} />
        ))}
      </ul>
      {rest.length === 0 ? null : (
        <details className="group">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-sm text-label text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform duration-150 group-open:rotate-180"
            />
            Ver as outras {rest.length} vendas
          </summary>
          <ul className="mt-3 grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {rest.map((item) => (
              <ComparableRow key={item.id} item={item} excluded={excludedSet.has(item.id)} onToggle={toggleSale} />
            ))}
          </ul>
        </details>
      )}
      {excludedCount > 0 ? (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-strong bg-surface-subtle px-3.5 py-2.5 text-label text-foreground shadow-md">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            {isPending ? (
              <span className="text-muted">Recalculando faixa ({salesLabel(excludedCount)} fora da conta)…</span>
            ) : answer.kind === "band" ? (
              <>
                <span>
                  Faixa recalculada:{" "}
                  <span className="font-semibold">
                    {formatCompactBRL(cents(answer.lowCents))} a {formatCompactBRL(cents(answer.highCents))}
                  </span>
                </span>
                <span className="text-muted">
                  · mediana {formatCompactBRL(cents(answer.medianCents))}
                  {answer.marketRatio === null ? "" : ` (${formatRatio(answer.marketRatio)} da FIPE)`} ·{" "}
                  {salesLabel(answer.n)}
                </span>
                {answer.confidence === "low" ? (
                  <Badge variant="warning">Confiança {CONFIDENCE_SHORT_LABELS[answer.confidence]}</Badge>
                ) : (
                  <span className="text-muted">· confiança {CONFIDENCE_SHORT_LABELS[answer.confidence]}</span>
                )}
              </>
            ) : (
              <span>
                Restam {salesLabel(answer.n)} na conta{" "}
                <span className="text-muted">(a faixa precisa de {answer.needed}).</span>
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => commitExcluded([], { focusHeading: true })}
          >
            <RotateCcw aria-hidden="true" />
            Voltar todas para a conta
          </Button>
        </div>
      ) : null}
    </>
  );
}

function ComparableRow({
  item,
  excluded,
  onToggle,
}: {
  item: SerializableComparable;
  excluded: boolean;
  onToggle: (id: string) => void;
}) {
  const endedAt = new Date(item.endsAtMs);
  const facts = [
    item.modelYear === null ? null : String(item.modelYear),
    item.mileageKm === null ? "km não informado" : formatKm(item.mileageKm),
    item.origin === null ? null : ORIGIN_LABELS[item.origin],
    item.city !== null && item.state !== null ? `${item.city}/${item.state}` : item.state,
    item.source,
  ].filter((part) => part !== null);

  return (
    <li
      className={cn(
        "grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-2 bg-surface p-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto]",
        excluded && "bg-surface-subtle",
      )}
    >
      <div className="relative row-span-2 aspect-4/3 overflow-hidden rounded-sm bg-surface-subtle sm:row-span-1">
        {item.photoUrl ? (
          <Image src={item.photoUrl} alt="" fill unoptimized loading="lazy" sizes="5rem" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-subtle">
            <Car aria-hidden="true" className="size-5" />
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-1">
        <p title={item.title} className="line-clamp-2 text-body font-medium text-foreground">
          <span className="text-muted tabular-nums">{formatDate(endedAt)} · </span>
          {item.title}
        </p>
        <p className="text-caption text-muted tabular-nums">{facts.join(" · ")}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body tabular-nums">
          <span className={cn("font-semibold text-foreground", excluded && "line-through")}>
            {formatCompactBRL(cents(item.finalBidCents))}
          </span>
          {item.marketValueCents === null ? null : (
            <span className="text-caption text-muted">
              {formatRatio(item.finalBidCents / item.marketValueCents)} da FIPE
            </span>
          )}
          {excluded ? <Badge variant="outline">Fora da conta</Badge> : null}
        </p>
        {item.reasons.length === 0 ? null : (
          <p className="text-caption text-muted">
            {item.reasons.map((reason) => SIMILARITY_LABELS[reason]).join(" · ")}
          </p>
        )}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end">
        <Button
          type="button"
          variant={excluded ? "secondary" : "ghost"}
          size="sm"
          aria-label={`${excluded ? "Voltar para a conta" : "Tirar da conta"}: ${item.title}, ${formatDate(endedAt)}`}
          onClick={() => onToggle(item.id)}
        >
          {excluded ? "Voltar para a conta" : "Tirar da conta"}
        </Button>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir anúncio: ${item.title} (abre em nova aba)`}
          className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-label text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
        >
          Anúncio
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </li>
  );
}
