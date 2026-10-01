import { Car, ClipboardCheck, Clock, ExternalLink, MapPin } from "lucide-react";
import Image from "next/image";

import { Badge, ButtonLink, Money } from "@/components/ui";
import { formatDateTime, formatKm, formatRatio } from "@/lib/format";

import {
  CONDITION_FLAG_LABELS,
  DAMAGE_LABELS,
  DAMAGE_VARIANTS,
  INSPECTION_LABELS,
  INSPECTION_VARIANTS,
  LISTING_STATUS_LABELS,
  LISTING_STATUS_VARIANTS,
} from "../labels";
import type { ListingEstimate, ListingListItem } from "../types";
import { AddToTrackerButton } from "./add-to-tracker-button";

type ListingCardProps = {
  item: ListingListItem;
  /** Linha acima do conteúdo (ex.: "Novo veículo encontrado" no alerta). */
  header?: React.ReactNode;
  /** Ações abaixo de "Adicionar à análise" (ex.: "Marcar como lido"). */
  footer?: React.ReactNode;
  /** Primeira linha da lista, visível sem rolar: a foto carrega já (é a candidata a LCP), sem esperar o lazy. */
  eager?: boolean;
};

/** Anúncio coletado em cartão: "Descobertos" e alertas. Direção A: foto arredondada e conteúdo sem caixa. */
export function ListingCard({ item, header, footer, eager = false }: ListingCardProps) {
  const isOpen = item.status === "open";
  const bid = isOpen ? (item.currentBid ?? item.minimumBid) : item.finalBid;
  const ratio = bid !== null && item.marketValue !== null && item.marketValue > 0 ? bid / item.marketValue : null;

  return (
    <article className="grid h-full content-start gap-3.5">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-surface-subtle">
        {item.photoUrl ? (
          // Foto direto da fonte (D-29): sem otimização do Next, que baixaria e guardaria a imagem.
          <Image
            src={item.photoUrl}
            alt=""
            fill
            unoptimized
            loading={eager ? "eager" : "lazy"}
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          // A fonte ainda não publicou fotos (o Leilo mostra "Fotos em breve"); a revisita traz quando saírem.
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-subtle">
            <Car aria-hidden="true" className="size-10" />
            <span className="text-caption text-muted">{item.status === "open" ? "Fotos em breve" : "Sem fotos"}</span>
          </div>
        )}
        <Badge variant={LISTING_STATUS_VARIANTS[item.status]} className="absolute top-2.5 left-2.5 bg-surface/95">
          {LISTING_STATUS_LABELS[item.status]}
        </Badge>
        {item.lotNumber ? (
          <span className="absolute top-2.5 right-2.5 flex h-5.5 items-center rounded-sm bg-surface/95 px-2 font-mono text-caption text-foreground-secondary uppercase">
            Lote {item.lotNumber}
          </span>
        ) : null}
      </div>

      {header}

      <div className="grid gap-0.5">
        <h3 className="text-heading-3 text-foreground">
          {item.title}
          {item.modelYear ? <span className="font-medium text-muted tabular-nums"> {item.modelYear}</span> : null}
        </h3>
        <p className="text-label font-normal text-muted">
          {[item.mileageKm === null ? null : formatKm(item.mileageKm), item.fuel, item.recoveryType]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <ConditionBadges item={item} />

      <dl className="flex items-end justify-between gap-4">
        <div className="grid gap-0.5">
          <dt className="text-caption text-muted">
            {isOpen ? (item.currentBid ? "Lance atual" : "Lance inicial") : "Lance final"}
          </dt>
          <dd className="text-heading-2 font-semibold text-foreground">
            <Money value={bid} />
          </dd>
        </div>
        <div className="grid gap-0.5 text-right">
          <dt className="text-caption text-muted">Mercado na fonte</dt>
          <dd className="text-body font-medium text-foreground-secondary">
            <Money value={item.marketValue} />
          </dd>
        </div>
      </dl>

      {ratio !== null ? (
        <div className="grid gap-1.5">
          <div aria-hidden="true" className="h-1 rounded-full bg-border">
            <div className="h-1 rounded-full bg-foreground" style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
          </div>
          <p className="text-caption text-muted tabular-nums">Lance em {formatRatio(ratio)} do valor de mercado</p>
        </div>
      ) : null}

      <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-label font-normal text-foreground-secondary">
        <span className="flex items-center gap-1.5 tabular-nums">
          <Clock aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
          {isOpen ? "Encerra" : "Encerrou"} {item.endsAt ? formatDateTime(item.endsAt) : "—"}
        </span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
          {item.city && item.state ? `${item.city}/${item.state}` : "Local não informado"}
          {item.distanceKm === null ? null : ` · ${Math.round(item.distanceKm)} km`}
        </span>
      </p>

      {item.estimate ? <EstimateLines estimate={item.estimate} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <TrackerAction item={item} />
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-label text-accent hover:underline"
        >
          Ver lote no {item.sourceName}
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </div>
      {footer}
    </article>
  );
}

/**
 * Estimativas com dados do sistema (etapa 5, D-36), sempre com o número de casos. Sem base, diz o que falta em vez de
 * inventar um número.
 */
function EstimateLines({ estimate }: { estimate: ListingEstimate }) {
  const { price, limit } = estimate;
  return (
    <section aria-label="Estimativas do sistema" className="rounded-md bg-background px-3 py-2.5 text-caption">
      <dl className="grid gap-2">
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt className="text-muted">Provável</dt>
          <dd className="text-right">
            {price.kind === "insufficient" ? (
              <span className="text-muted">
                Sem base suficiente ({price.comparables} de {price.needed})
              </span>
            ) : (
              <>
                <Money value={price.median} className="font-semibold text-foreground" />{" "}
                <span className="text-muted">(n={price.n})</span>
              </>
            )}
            {price.kind === "comparables" ? (
              <span className="block text-muted">
                Faixa <Money value={price.low} /> a <Money value={price.high} /> em vendas parecidas
              </span>
            ) : null}
            {price.kind === "market_ratio" ? (
              <span className="block text-muted">
                {formatRatio(price.ratio.median)} do mercado, como vendas na mesma categoria e condição (faixa{" "}
                {formatRatio(price.ratio.low)} a {formatRatio(price.ratio.high)})
              </span>
            ) : null}
          </dd>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt className="text-muted">Limite estimado</dt>
          <dd className="text-right">
            {limit.kind === "insufficient" ? (
              <span className="text-muted">
                Faça {limit.needed} análises parecidas ({limit.analyses} de {limit.needed})
              </span>
            ) : (
              <>
                {limit.maxBid === null ? (
                  <span className="text-foreground">Sem lance viável</span>
                ) : (
                  <Money value={limit.maxBid} className="font-semibold text-foreground" />
                )}{" "}
                <span className="text-muted">
                  ({limit.n} análises{limit.marketValueFrom === "listing" ? ", venda pela FIPE do anúncio" : ""})
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Já no Tracker: leva ao lote. Senão, "Adicionar à análise" (só com marca, modelo e ano). */
function TrackerAction({ item }: { item: ListingListItem }) {
  if (item.trackedLotId) {
    return (
      <ButtonLink href={`/lotes/${item.trackedLotId}`} variant="secondary" size="sm" className="w-fit">
        <ClipboardCheck aria-hidden="true" />
        Ver no Tracker
      </ButtonLink>
    );
  }
  return item.trackable ? <AddToTrackerButton listingId={item.id} /> : null;
}

/** Condição declarada pelo leiloeiro. Sem nada declarado, não mostra nada (não afirma "sem dano"). */
function ConditionBadges({ item }: { item: ListingListItem }) {
  const { damageLevel, conditionFlags, inspection, inspectionNotes } = item;
  if (damageLevel === null && conditionFlags.length === 0 && inspection === null) return null;

  return (
    <ul aria-label="Condição informada pelo leiloeiro" className="flex flex-wrap gap-1.5">
      {damageLevel ? (
        <li>
          <Badge variant={DAMAGE_VARIANTS[damageLevel]}>{DAMAGE_LABELS[damageLevel]}</Badge>
        </li>
      ) : null}
      {conditionFlags.map((flag) => (
        <li key={flag}>
          <Badge variant="outline">{CONDITION_FLAG_LABELS[flag]}</Badge>
        </li>
      ))}
      {inspection ? (
        <li>
          <Badge variant={INSPECTION_VARIANTS[inspection]} title={inspectionNotes ?? undefined}>
            {INSPECTION_LABELS[inspection]}
          </Badge>
        </li>
      ) : null}
    </ul>
  );
}
