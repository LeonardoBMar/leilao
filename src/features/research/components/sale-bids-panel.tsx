"use client";

import { X } from "lucide-react";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";

import { StepLine } from "@/components/charts/step-line";
import { ButtonLink, SegmentedControl } from "@/components/ui";
import { cents } from "@/domain/money";
import { MIN_SALE_BID_STEPS, saleBidsAxisHours } from "@/domain/research/sale-bids";
import { niceRange } from "@/lib/charts";
import { formatBRL, formatCompactBRL, formatDateTime, formatRatio } from "@/lib/format";

import type { SaleBids } from "../types";

type Measure = "price" | "ratio";

/** "2,5 h antes do fim", "no fim". */
function hoursLabel(hoursBefore: number): string {
  if (hoursBefore === 0) return "no fim";
  const hours = -hoursBefore;
  return hours < 1
    ? `${Math.round(hours * 60)} min antes do fim`
    : `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h antes do fim`;
}

/**
 * Lances de uma venda (D-45), escolhida na tabela ou na dispersão do modelo: os degraus que o coletor viu nas horas
 * antes do fim, em R$ ou em % da FIPE, com a linha do valor de mercado. Entre duas visitas do coletor o lance
 * pode ter mudado sem registro, e o texto diz isso.
 */
export function SaleBidsPanel({ bids, closeHref }: { bids: SaleBids; closeHref: Route }) {
  const [measure, setMeasure] = useState<Measure>("price");
  const sectionRef = useRef<HTMLElement>(null);
  // O bloco chega por streaming, depois da âncora: o painel rola até si ao abrir (ou trocar de venda).
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [bids.id]);
  const { marketValue } = bids;
  const effective: Measure = marketValue === null ? "price" : measure;
  const valueOf = (bid: number) => (effective === "ratio" && marketValue !== null ? bid / marketValue : bid);
  const format = (value: number) =>
    effective === "ratio" ? formatRatio(value) : formatCompactBRL(cents(Math.round(value)));

  const axisHours = saleBidsAxisHours(bids.steps);
  const values = bids.steps.map((step) => valueOf(step.bid));
  const reference = marketValue === null ? null : valueOf(marketValue);
  // A referência só entra no eixo se não esmaga a subida (valor de mercado muito acima dos lances).
  const top = Math.max(...values);
  const showReference = reference !== null && reference <= top * 1.6;
  const { domain, ticks } = niceRange(Math.min(...values), showReference ? Math.max(top, reference) : top);
  const first = bids.steps[0];
  const rise = first === undefined || first.bid === 0 ? null : bids.finalBid / first.bid - 1;

  return (
    <section
      ref={sectionRef}
      aria-label="Lances da venda"
      className="grid scroll-mt-20 gap-4 rounded-md border border-border p-4 lg:scroll-mt-60"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <a
            href={bids.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-1 text-body font-medium text-accent hover:text-accent-hover hover:underline"
          >
            {bids.title}
          </a>
          <p className="text-caption text-muted tabular-nums">
            Encerrada em {formatDateTime(bids.endsAt)} · lance final {formatBRL(bids.finalBid)}
            {marketValue === null ? "" : ` (${formatRatio(bids.finalBid / marketValue)} da FIPE)`}
          </p>
        </div>
        <ButtonLink href={closeHref} scroll={false} variant="ghost" size="icon" aria-label="Fechar os lances da venda">
          <X aria-hidden="true" />
        </ButtonLink>
      </div>
      {bids.steps.length < MIN_SALE_BID_STEPS ? (
        <p className="text-body text-muted">O coletor só viu o lance final desta venda.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            {rise === null || first === undefined ? null : (
              <p className="text-body text-foreground">
                Subiu {formatRatio(rise)} desde o primeiro lance visto, {hoursLabel(first.hoursBefore)}.
              </p>
            )}
            {marketValue === null ? null : (
              <SegmentedControl<Measure>
                label="Medida dos lances"
                hideLabel
                value={measure}
                options={[
                  { value: "price", label: "R$" },
                  { value: "ratio", label: "% da FIPE" },
                ]}
                onValueChange={setMeasure}
                className="w-56"
              />
            )}
          </div>
          <StepLine
            ariaLabel={`Lances da venda: ${bids.steps.map((step) => `${format(valueOf(step.bid))} ${hoursLabel(step.hoursBefore)}`).join("; ")}.`}
            xDomain={[-axisHours, 0]}
            xTicks={[1, 0.75, 0.5, 0.25, 0].map((share) => ({
              value: -axisHours * share,
              label: share === 0 ? "Fim" : `−${(axisHours * share).toLocaleString("pt-BR")} h`,
            }))}
            yDomain={domain}
            yTicks={ticks.map((value) => ({ value, label: format(value) }))}
            reference={
              showReference && reference !== null ? { value: reference, label: `FIPE ${format(reference)}` } : undefined
            }
            endLabel={format(valueOf(bids.finalBid))}
            points={bids.steps.map((step) => ({
              key: String(step.hoursBefore),
              x: step.hoursBefore,
              y: valueOf(step.bid),
              title: `${format(valueOf(step.bid))}, ${hoursLabel(step.hoursBefore)}`,
            }))}
          />
          <p className="text-caption text-muted">
            {bids.steps.length} lances vistos pelo coletor. Entre duas visitas, o lance pode ter mudado sem registro.
          </p>
        </>
      )}
    </section>
  );
}
