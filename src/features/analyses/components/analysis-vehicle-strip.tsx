"use client";

import { Car, ChevronDown, ChevronUp, Clock, ExternalLink, Images, KeyRound, MapPin } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Badge, Button, Money } from "@/components/ui";
import type { Cents } from "@/domain/money";
import {
  CONDITION_FLAG_LABELS,
  DAMAGE_LABELS,
  DAMAGE_VARIANTS,
  INSPECTION_LABELS,
  INSPECTION_VARIANTS,
} from "@/features/listings/labels";
import { formatDateTime, formatKm } from "@/lib/format";

import type { AnalysisVehicleContext } from "../types";

type AnalysisVehicleStripProps = {
  title: string;
  currentBid: Cents | null;
  context: AnalysisVehicleContext;
  /** Fotos combinadas do lote (privadas + anúncio ligado), já resolvidas no servidor. */
  photoUrls: string[];
};

/**
 * Faixa de contexto do veículo na tela de análise: mantém fotos, km, condição declarada e link do leiloeiro
 * acessíveis durante o preenchimento de reparos e custos, evitando troca de abas.
 */
export function AnalysisVehicleStrip({ title, currentBid, context, photoUrls }: AnalysisVehicleStripProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const coverUrl = photoUrls[0] ?? null;
  const activeUrl = photoUrls[selectedIndex] ?? coverUrl;

  const location = context.city && context.state ? `${context.city}/${context.state}` : null;
  const metaParts = [
    context.mileageKm === null ? null : formatKm(context.mileageKm),
    context.fuel,
    context.recoveryType,
  ].filter(Boolean);

  return (
    <section
      aria-label="Contexto do veículo"
      className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {coverUrl ? (
            <button
              type="button"
              onClick={() => setGalleryOpen((open) => !open)}
              aria-expanded={galleryOpen}
              aria-label={galleryOpen ? "Ocultar fotos do veículo" : `Ver ${photoUrls.length} fotos do veículo`}
              className="relative h-15 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-surface-subtle outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Image src={coverUrl} alt="" fill unoptimized sizes="5rem" className="object-cover" />
              {photoUrls.length > 1 ? (
                <span className="absolute right-1 bottom-1 rounded-sm bg-primary/85 px-1.5 py-0.5 text-caption font-medium text-white tabular-nums">
                  {photoUrls.length}
                </span>
              ) : null}
            </button>
          ) : (
            <div
              aria-hidden="true"
              className="flex h-15 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-muted-subtle"
            >
              <Car className="size-6" />
            </div>
          )}

          <div className="grid min-w-0 gap-1">
            {context.vehicleVersion ? (
              <p className="truncate text-label text-foreground-secondary">{context.vehicleVersion}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5">
              {context.damageLevel ? (
                <Badge variant={DAMAGE_VARIANTS[context.damageLevel]}>{DAMAGE_LABELS[context.damageLevel]}</Badge>
              ) : null}
              {context.conditionFlags.map((flag) => (
                <Badge key={flag} variant="outline">
                  {CONDITION_FLAG_LABELS[flag]}
                </Badge>
              ))}
              {context.inspection ? (
                <Badge variant={INSPECTION_VARIANTS[context.inspection]} title={context.inspectionNotes ?? undefined}>
                  {INSPECTION_LABELS[context.inspection]}
                </Badge>
              ) : null}
              {context.hasKey === true ? (
                <Badge variant="default">
                  <KeyRound aria-hidden="true" className="mr-1 size-3" />
                  Com chave
                </Badge>
              ) : context.hasKey === false ? (
                <Badge variant="warning">Sem chave</Badge>
              ) : null}
            </div>

            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted tabular-nums">
              {currentBid !== null ? (
                <span>
                  Lance atual <Money value={currentBid} className="font-semibold text-foreground" />
                </span>
              ) : null}
              {metaParts.length > 0 ? <span>{metaParts.join(" · ")}</span> : null}
              {location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                  {location}
                </span>
              ) : null}
              {context.endsAt ? (
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden="true" className="size-3.5 shrink-0" />
                  Encerra {formatDateTime(context.endsAt)}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {photoUrls.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-expanded={galleryOpen}
              onClick={() => setGalleryOpen((open) => !open)}
            >
              <Images aria-hidden="true" />
              {galleryOpen ? "Ocultar fotos" : `Ver fotos (${photoUrls.length})`}
              {galleryOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </Button>
          ) : null}
          {context.lotUrl ? (
            <a
              href={context.lotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1 px-2 text-label text-accent hover:underline"
            >
              {context.sourceName ? `Abrir no ${context.sourceName}` : "Abrir anúncio"}
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          ) : null}
        </div>
      </div>

      {galleryOpen && activeUrl ? (
        <div className="grid gap-3 border-t border-border pt-4">
          <div className="relative aspect-16/10 max-h-96 w-full overflow-hidden rounded-lg bg-surface-subtle">
            <Image
              src={activeUrl}
              alt={`Foto ${selectedIndex + 1} de ${photoUrls.length} — ${title}`}
              fill
              unoptimized
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-contain"
            />
          </div>
          {photoUrls.length > 1 ? (
            <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Miniaturas das fotos">
              {photoUrls.map((url, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li key={`${url}-${index}`} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      aria-current={isSelected ? "true" : undefined}
                      aria-label={`Ver foto ${index + 1} de ${photoUrls.length}`}
                      className={`relative h-14 w-20 overflow-hidden rounded-md border bg-surface-subtle outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isSelected ? "border-accent ring-2 ring-accent/25" : "border-border opacity-75 hover:opacity-100"
                      }`}
                    >
                      <Image src={url} alt="" fill unoptimized sizes="5rem" className="object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
