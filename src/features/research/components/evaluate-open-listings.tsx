import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui";
import type { Cents } from "@/domain/money";
import type { EvaluateFilters } from "@/domain/research/evaluate";
import { bandPosition } from "@/domain/research/evaluate";
import { formatCompactBRL, formatDateTime, formatKm } from "@/lib/format";

import { BAND_POSITION_LABELS, BAND_POSITION_VARIANTS } from "../labels";
import { getOpenListingsFor } from "../queries";
import type { EvaluateOpenListing, EvaluationView } from "../types";
import { ResearchBlock } from "./research-block";

export const OPEN_LISTINGS_TITLE = "Lotes abertos do recorte";

/** Lotes abertos mostrados de início (e marcados no gráfico): os que encerram primeiro. Modelo comum passa de 100. */
export const OPEN_LISTINGS_SHOWN = 8;

/** O que fazer com um lote aberto (analisar, ver a análise), composto pela rota: junta outra feature. */
export type OpenListingAction = (listing: Pick<EvaluateOpenListing, "id" | "trackedLotId" | "trackable">) => ReactNode;

/**
 * Lotes abertos do mesmo recorte (docs/PLANO-MERCADO.md §5.2), do que encerra primeiro, com o lance atual frente à
 * faixa típica em texto (abaixo, dentro, acima) e a ação de analisar. O lance atual ainda sobe: "abaixo da faixa" é onde
 * o lote está agora, não onde vai fechar. Sem lote aberto, o bloco some.
 */
export async function EvaluateOpenListings({
  filters,
  evaluation,
  action,
}: {
  filters: EvaluateFilters;
  evaluation: EvaluationView;
  action: OpenListingAction;
}) {
  const listings = await getOpenListingsFor(filters);
  if (listings.length === 0) return null;
  const { answer } = evaluation;
  const band = answer.kind === "band" ? answer : null;
  const shown = listings.slice(0, OPEN_LISTINGS_SHOWN);
  const rest = listings.slice(OPEN_LISTINGS_SHOWN);
  return (
    <ResearchBlock
      id="abertos"
      title={`${OPEN_LISTINGS_TITLE} (${listings.length})`}
      description="O lance atual ainda sobe até o fim; compare com a faixa típica sabendo disso."
    >
      <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
        {shown.map((listing) => (
          <OpenListingRow key={listing.id} listing={listing} band={band} action={action} />
        ))}
      </ul>
      {rest.length === 0 ? null : (
        <details>
          <summary className="cursor-pointer text-label text-accent hover:underline">
            Ver os outros {rest.length} {rest.length === 1 ? "lote aberto" : "lotes abertos"}
          </summary>
          <ul className="mt-3 grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {rest.map((listing) => (
              <OpenListingRow key={listing.id} listing={listing} band={band} action={action} />
            ))}
          </ul>
        </details>
      )}
    </ResearchBlock>
  );
}

function OpenListingRow({
  listing,
  band,
  action,
}: {
  listing: EvaluateOpenListing;
  band: { low: Cents; high: Cents } | null;
  action: OpenListingAction;
}) {
  const position = band === null || listing.currentBid === null ? null : bandPosition(listing.currentBid, band);
  return (
    <li className="grid gap-2 bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="grid min-w-0 gap-1">
        <p title={listing.title} className="line-clamp-2 text-body font-medium text-foreground">
          {listing.title}
        </p>
        <p className="text-caption text-muted tabular-nums">
          {[
            listing.endsAt === null ? "fim não informado" : `encerra ${formatDateTime(listing.endsAt)}`,
            listing.modelYear === null ? null : String(listing.modelYear),
            listing.mileageKm === null ? null : formatKm(listing.mileageKm),
            listing.city !== null && listing.state !== null ? `${listing.city}/${listing.state}` : listing.state,
            listing.source,
          ]
            .filter((part) => part !== null)
            .join(" · ")}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-body tabular-nums">
          <span className="text-foreground">
            Lance atual{" "}
            <span className="font-semibold">
              {listing.currentBid === null ? "—" : formatCompactBRL(listing.currentBid)}
            </span>
          </span>
          {position === null ? null : (
            <Badge variant={BAND_POSITION_VARIANTS[position]}>{BAND_POSITION_LABELS[position]}</Badge>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {action(listing)}
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-label text-accent hover:underline"
        >
          Anúncio
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </div>
    </li>
  );
}
