import { Car, ClipboardCheck, Clock, ExternalLink, MapPin } from "lucide-react";
import Image from "next/image";

import { Badge, ButtonLink, Money } from "@/components/ui";
import type { Cents } from "@/domain/money";
import { formatDateTime, formatKm, formatRatio } from "@/lib/format";

import {
  CONDITION_FLAG_LABELS,
  DAMAGE_LABELS,
  DAMAGE_VARIANTS,
  INSPECTION_LABELS,
  INSPECTION_VARIANTS,
  LIMIT_FIT_LABELS,
  LIMIT_FIT_VARIANTS,
  LISTING_STATUS_LABELS,
  LISTING_STATUS_VARIANTS,
  marketValueOriginLabel,
  priceEvidenceLabel,
} from "../labels";
import type { ListingListItem } from "../types";
import { AddToTrackerButton } from "./add-to-tracker-button";
import { ListingQuickDrawer } from "./listing-quick-drawer";

type ListingCardProps = {
  item: ListingListItem;
  /** Linha acima do conteúdo (ex.: "Novo veículo encontrado" no alerta). */
  header?: React.ReactNode;
  /** Ações abaixo de "Adicionar à análise" (ex.: "Marcar como lido"). */
  footer?: React.ReactNode;
  /** Primeira linha da lista, visível sem rolar: a foto carrega já (é a candidata a LCP), sem esperar o lazy. */
  eager?: boolean;
  /** Linha com miniatura (dashboard): título, lance, situação frente ao limite, fim e ações. */
  compact?: boolean;
};

/** Anúncio coletado em cartão: "Leilões" e alertas. Direção A: foto arredondada e conteúdo sem caixa. */
export function ListingCard({ item, header, footer, eager = false, compact = false }: ListingCardProps) {
  const isOpen = item.status === "open";
  const bid = isOpen ? (item.currentBid ?? item.minimumBid) : item.finalBid;
  const ratio = bid !== null && item.marketValue !== null && item.marketValue > 0 ? bid / item.marketValue : null;
  const marketOrigin = marketValueOriginLabel(item.marketValueOrigin, item.marketValueRefMonth);
  const fit = item.estimate?.fit ?? null;

  if (compact) return <CompactCard item={item} bid={bid} footer={footer} />;

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

      <div className="grid gap-3 rounded-md bg-background p-3 sm:grid-cols-2">
        <div className="grid content-start gap-0.5">
          <p className="text-caption text-muted">
            {isOpen ? (item.currentBid ? "Lance atual" : "Lance inicial") : "Lance final"}
          </p>
          <p className="text-heading-2 font-semibold text-foreground tabular-nums">
            <Money value={bid} />
          </p>
          {item.marketValue !== null ? (
            <p className="text-caption text-muted tabular-nums">
              {marketOrigin ? `${marketOrigin} ` : "Mercado "}
              <Money value={item.marketValue} />
              {ratio !== null ? ` · ${formatRatio(ratio)}` : null}
            </p>
          ) : null}
        </div>

        {item.estimate ? (
          <div className="grid content-start gap-0.5 border-t border-border-strong pt-2.5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
            <p className="text-caption text-muted">Estimativa</p>
            <p className="text-body-lg font-semibold text-foreground tabular-nums">
              {item.estimate.price.kind === "insufficient" ? (
                <span className="text-caption font-normal text-muted">
                  Sem base ({item.estimate.price.comparables}/{item.estimate.price.needed})
                </span>
              ) : (
                <Money value={item.estimate.price.median} />
              )}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted tabular-nums">
              {item.estimate.limit.kind === "insufficient" ? (
                <span>Sem limite</span>
              ) : item.estimate.limit.maxBid === null ? (
                <span>Sem lance viável</span>
              ) : (
                <span>
                  Lim. <Money value={item.estimate.limit.maxBid} className="font-medium text-foreground-secondary" />
                </span>
              )}
              {fit === null ? null : <Badge variant={LIMIT_FIT_VARIANTS[fit]}>{LIMIT_FIT_LABELS[fit]}</Badge>}
            </div>
          </div>
        ) : null}
      </div>

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

      <div className="flex flex-wrap items-center gap-2">
        <TrackerAction item={item} />
        <ListingQuickDrawer item={item} />
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-label text-accent hover:underline"
        >
          {item.sourceName}
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </div>
      {footer}
    </article>
  );
}

/** Já no Tracker: leva ao lote. Senão, adiciona à análise ou abre direto o rascunho. */
function TrackerAction({ item, openDirectly = false }: { item: ListingListItem; openDirectly?: boolean }) {
  if (item.trackedLotId) {
    return (
      <ButtonLink href={`/lotes/${item.trackedLotId}`} variant="secondary" size="sm" className="w-fit">
        <ClipboardCheck aria-hidden="true" />
        Ver minha análise
      </ButtonLink>
    );
  }
  return item.trackable ? <AddToTrackerButton listingId={item.id} mode={openDirectly ? "open" : "stay"} /> : null;
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

/** Variante em linha (dashboard): miniatura, título, lance com a situação, fim e as ações. */
function CompactCard({ item, bid, footer }: { item: ListingListItem; bid: Cents | null; footer: React.ReactNode }) {
  const fit = item.estimate?.fit ?? null;
  const price = item.estimate?.price;
  return (
    <article className="grid w-full grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <div className="relative row-span-2 aspect-4/3 overflow-hidden rounded-md bg-surface-subtle">
        {item.photoUrl ? (
          <Image src={item.photoUrl} alt="" fill unoptimized loading="lazy" sizes="8rem" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-subtle">
            <Car aria-hidden="true" className="size-6" />
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-0.5">
        <h3 className="truncate text-body font-semibold text-foreground">
          {item.title}
          {item.modelYear ? <span className="font-medium text-muted tabular-nums"> {item.modelYear}</span> : null}
        </h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted tabular-nums">
          <span>
            Lance <Money value={bid} className="font-semibold text-foreground" />
          </span>
          {price && price.kind !== "insufficient" ? (
            <span>
              · provável <Money value={price.median} /> ({priceEvidenceLabel(price)})
            </span>
          ) : null}
          {fit === null ? null : <Badge variant={LIMIT_FIT_VARIANTS[fit]}>{LIMIT_FIT_LABELS[fit]}</Badge>}
        </p>
        <p className="flex items-center gap-1.5 text-caption text-muted tabular-nums">
          <Clock aria-hidden="true" className="size-3.5 shrink-0" />
          Encerra {item.endsAt ? formatDateTime(item.endsAt) : "—"}
          {item.city && item.state ? ` · ${item.city}/${item.state}` : null}
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2">
        <TrackerAction item={item} openDirectly />
        <ListingQuickDrawer item={item} />
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-label text-accent hover:underline"
        >
          {item.sourceName}
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
        {footer}
      </div>
    </article>
  );
}
