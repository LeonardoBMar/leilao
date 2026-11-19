"use client";

import { Car, ClipboardCheck, Clock, ExternalLink, Eye, MapPin } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Money,
} from "@/components/ui";
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
  priceBasisLabel,
  priceEvidenceLabel,
} from "../labels";
import type { ListingListItem } from "../types";
import { AddToTrackerButton } from "./add-to-tracker-button";

type ListingQuickDrawerProps = {
  item: ListingListItem;
  /** Gatilho customizado (ex.: título clicável); sem ele, renderiza o botão "Inspecionar". */
  trigger?: React.ReactNode;
};

/**
 * Gaveta de pré-visualização rápida de um anúncio do catálogo: reúne foto, condição, leitura financeira
 * e a escolha direta entre salvar na fila ou abrir o rascunho em um clique.
 */
export function ListingQuickDrawer({ item, trigger }: ListingQuickDrawerProps) {
  const [open, setOpen] = useState(false);
  const isOpen = item.status === "open";
  const bid = isOpen ? (item.currentBid ?? item.minimumBid) : item.finalBid;
  const ratio = bid !== null && item.marketValue !== null && item.marketValue > 0 ? bid / item.marketValue : null;
  const marketOrigin = marketValueOriginLabel(item.marketValueOrigin, item.marketValueRefMonth);
  const estimate = item.estimate;
  const fit = estimate?.fit ?? null;
  const details = [item.mileageKm === null ? null : formatKm(item.mileageKm), item.fuel, item.recoveryType].filter(
    Boolean,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="ghost" size="sm" className="w-fit">
            <Eye aria-hidden="true" />
            Inspecionar
          </Button>
        )}
      </DialogTrigger>
      <DrawerContent side="right" className="max-w-lg">
        <div className="border-b border-border px-5 py-4 md:px-6">
          <DialogHeader>
            <p className="font-mono text-overline text-muted uppercase">
              {[item.lotNumber ? `Lote ${item.lotNumber}` : null, item.sourceName].filter(Boolean).join(" · ")}
            </p>
            <DialogTitle>
              {item.title}
              {item.modelYear ? <span className="font-medium text-muted tabular-nums"> {item.modelYear}</span> : null}
            </DialogTitle>
            {details.length > 0 ? <DialogDescription>{details.join(" · ")}</DialogDescription> : null}
          </DialogHeader>
        </div>

        <DrawerBody className="gap-5">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-surface-subtle">
            {item.photoUrl ? (
              <Image
                src={item.photoUrl}
                alt=""
                fill
                unoptimized
                sizes="(min-width: 768px) 32rem, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-subtle">
                <Car aria-hidden="true" className="size-10" />
                <span className="text-caption text-muted">{isOpen ? "Fotos em breve" : "Sem fotos"}</span>
              </div>
            )}
            <Badge variant={LISTING_STATUS_VARIANTS[item.status]} className="absolute top-2.5 left-2.5 bg-surface/95">
              {LISTING_STATUS_LABELS[item.status]}
            </Badge>
          </div>

          {item.damageLevel !== null || item.conditionFlags.length > 0 || item.inspection !== null ? (
            <ul aria-label="Condição informada pelo leiloeiro" className="flex flex-wrap gap-1.5">
              {item.damageLevel ? (
                <li>
                  <Badge variant={DAMAGE_VARIANTS[item.damageLevel]}>{DAMAGE_LABELS[item.damageLevel]}</Badge>
                </li>
              ) : null}
              {item.conditionFlags.map((flag) => (
                <li key={flag}>
                  <Badge variant="outline">{CONDITION_FLAG_LABELS[flag]}</Badge>
                </li>
              ))}
              {item.inspection ? (
                <li>
                  <Badge variant={INSPECTION_VARIANTS[item.inspection]} title={item.inspectionNotes ?? undefined}>
                    {INSPECTION_LABELS[item.inspection]}
                  </Badge>
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="grid gap-3 rounded-lg bg-background p-4 sm:grid-cols-2">
            <div className="grid content-start gap-1">
              <p className="text-caption text-muted">
                {isOpen ? (item.currentBid ? "Lance atual" : "Lance inicial") : "Lance final"}
              </p>
              <p className="text-heading-2 font-semibold text-foreground tabular-nums">
                <Money value={bid} />
              </p>
              {item.marketValue !== null ? (
                <p className="text-caption text-muted tabular-nums">
                  Mercado{marketOrigin ? ` ${marketOrigin}` : ""} <Money value={item.marketValue} />
                  {ratio !== null ? ` (${formatRatio(ratio)})` : null}
                </p>
              ) : null}
            </div>

            {estimate ? (
              <div className="grid content-start gap-1 border-t border-border-strong pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                <p className="text-caption text-muted">Provável × limite estimado</p>
                <p className="text-heading-2 font-semibold text-foreground tabular-nums">
                  {estimate.price.kind === "insufficient" ? (
                    <span className="text-body font-normal text-muted">
                      Sem base ({estimate.price.comparables}/{estimate.price.needed})
                    </span>
                  ) : (
                    <Money value={estimate.price.median} />
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted tabular-nums">
                  {estimate.limit.kind === "insufficient" ? (
                    <span>Sem limite estimado</span>
                  ) : estimate.limit.maxBid === null ? (
                    <span>Sem lance viável</span>
                  ) : (
                    <span>
                      Limite <Money value={estimate.limit.maxBid} className="font-medium text-foreground" />
                    </span>
                  )}
                  {fit ? <Badge variant={LIMIT_FIT_VARIANTS[fit]}>{LIMIT_FIT_LABELS[fit]}</Badge> : null}
                </div>
              </div>
            ) : null}
          </div>

          {estimate ? (
            <ul className="grid gap-1 text-caption text-muted">
              {estimate.price.kind === "comparables" ? (
                <li>
                  Provável ({priceEvidenceLabel(estimate.price)}): {priceBasisLabel(estimate.price)}. Metade das
                  próximas vendas deve ficar entre <Money value={estimate.price.low} /> e{" "}
                  <Money value={estimate.price.high} />.
                </li>
              ) : estimate.price.kind === "market_ratio" ? (
                <li>
                  Provável: {formatRatio(estimate.price.ratio.median)} do mercado na mesma categoria e condição (faixa{" "}
                  {formatRatio(estimate.price.ratio.low)} a {formatRatio(estimate.price.ratio.high)}; n=
                  {estimate.price.n}).
                </li>
              ) : null}
              {estimate.limit.kind !== "insufficient" ? (
                <li>
                  Limite:{" "}
                  {estimate.limit.kind === "defaults"
                    ? "premissas padrão (pessimistas de propósito)."
                    : `${estimate.limit.n} análises parecidas${estimate.limit.marketValueFrom === "listing" ? ", venda pela FIPE do anúncio" : ""}.`}
                </li>
              ) : null}
            </ul>
          ) : null}

          <dl className="grid gap-2 border-t border-border pt-4 text-label font-normal text-foreground-secondary">
            {item.auctionName ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Leilão</dt>
                <dd className="text-right text-foreground">{item.auctionName}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-muted">
                <Clock aria-hidden="true" className="size-3.5" />
                {isOpen ? "Encerra" : "Encerrou"}
              </dt>
              <dd className="text-right tabular-nums">{item.endsAt ? formatDateTime(item.endsAt) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-muted">
                <MapPin aria-hidden="true" className="size-3.5" />
                Pátio
              </dt>
              <dd className="text-right tabular-nums">
                {item.city && item.state ? `${item.city}/${item.state}` : "Local não informado"}
                {item.distanceKm === null ? null : ` · ${Math.round(item.distanceKm)} km`}
              </dd>
            </div>
          </dl>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-label text-accent hover:underline"
          >
            Ver lote no {item.sourceName}
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </DrawerBody>

        <DrawerFooter>
          {item.trackedLotId ? (
            <ButtonLink href={`/lotes/${item.trackedLotId}`} onClick={() => setOpen(false)}>
              <ClipboardCheck aria-hidden="true" />
              Ver minha análise
            </ButtonLink>
          ) : item.trackable ? (
            <>
              <AddToTrackerButton
                listingId={item.id}
                mode="stay"
                label="Salvar na fila"
                variant="secondary"
                size="md"
                className="w-full md:w-auto"
                onAdded={() => setOpen(false)}
              />
              <AddToTrackerButton
                listingId={item.id}
                mode="open"
                label="Analisar agora"
                variant="primary"
                size="md"
                className="w-full md:w-auto"
              />
            </>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Dialog>
  );
}
