import { ExternalLink, MapPin } from "lucide-react";
import Image from "next/image";

import { Badge, Money } from "@/components/ui";
import { formatDateTime, formatKm } from "@/lib/format";

import {
  CONDITION_FLAG_LABELS,
  DAMAGE_LABELS,
  DAMAGE_VARIANTS,
  INSPECTION_LABELS,
  INSPECTION_VARIANTS,
  LISTING_STATUS_LABELS,
  LISTING_STATUS_VARIANTS,
} from "../labels";
import type { ListingListItem } from "../types";

type ListingCardProps = {
  item: ListingListItem;
  /** Linha acima do conteúdo (ex.: "Novo veículo encontrado" no alerta). */
  header?: React.ReactNode;
  /** Ações abaixo do link para a fonte (ex.: "Marcar como lido"). */
  footer?: React.ReactNode;
};

/** Anúncio coletado em cartão: "Descobertos" e alertas. */
export function ListingCard({ item, header, footer }: ListingCardProps) {
  const isOpen = item.status === "open";
  const bid = isOpen ? item.currentBid : item.finalBid;

  return (
    <article className="grid h-full content-start overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative aspect-4/3 bg-surface-subtle">
        {item.photoUrl ? (
          // Foto direto da fonte (D-29): sem otimização do Next, que baixaria e guardaria a imagem.
          <Image
            src={item.photoUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : null}
        <Badge variant={LISTING_STATUS_VARIANTS[item.status]} className="absolute top-2 left-2">
          {LISTING_STATUS_LABELS[item.status]}
        </Badge>
      </div>

      <div className="grid gap-3 p-4">
        {header}
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-foreground">
            {item.title}
            {item.modelYear ? ` ${item.modelYear}` : ""}
          </h3>
          <p className="text-caption text-muted">
            {[item.mileageKm === null ? null : formatKm(item.mileageKm), item.fuel, item.recoveryType]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <ConditionBadges item={item} />

        <p className="flex items-center gap-1 text-caption text-foreground-secondary">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {item.city && item.state ? `${item.city}/${item.state}` : "Local não informado"}
          {item.distanceKm === null ? null : ` · ${Math.round(item.distanceKm)} km`}
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
          <dt className="text-muted">{isOpen ? (item.currentBid ? "Lance atual" : "Lance inicial") : "Lance final"}</dt>
          <dd className="text-right font-semibold text-foreground">
            <Money value={isOpen ? (bid ?? item.minimumBid) : bid} />
          </dd>
          <dt className="text-muted">Mercado ({item.sourceName})</dt>
          <dd className="text-right">
            <Money value={item.marketValue} />
          </dd>
          <dt className="text-muted">{isOpen ? "Encerra" : "Encerrou"}</dt>
          <dd className="text-right tabular-nums">{item.endsAt ? formatDateTime(item.endsAt) : "—"}</dd>
        </dl>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-caption text-primary hover:underline"
        >
          Ver lote {item.lotNumber ?? ""} no {item.sourceName}
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
        {footer}
      </div>
    </article>
  );
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
