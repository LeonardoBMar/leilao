import { Section, SectionHeader, SectionTitle, Skeleton } from "@/components/ui";
import { MAX_IMAGES_PER_LOT } from "@/domain/lot-images";

import { listLotImages, listLotListingPhotos } from "../queries";
import { LotGallery } from "./lot-gallery";

/** Bloco "Fotos" da ficha do lote (SPEC RF-07): fotos do anúncio ligado (D-29) e fotos privadas enviadas. */
export async function LotPhotosPanel({ lotId }: { lotId: string }) {
  const [images, listingPhotos] = await Promise.all([listLotImages(lotId), listLotListingPhotos(lotId)]);

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Fotos</SectionTitle>
        <span className="text-caption text-muted tabular-nums">
          {listingPhotos.length > 0
            ? `${listingPhotos.length} do anúncio · ${images.length} de ${MAX_IMAGES_PER_LOT} enviadas`
            : `${images.length} de ${MAX_IMAGES_PER_LOT}`}
        </span>
      </SectionHeader>
      {listingPhotos.length > 0 ? (
        <div className="mb-5 grid gap-2.5">
          <p className="text-caption font-medium text-muted">Fotos do anúncio coletado</p>
          <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {listingPhotos.map((url, index) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md border border-border bg-surface-subtle transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Foto ${index + 1} do anúncio`}
                    loading="lazy"
                    className="aspect-4/3 w-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <LotGallery lotId={lotId} images={images} />
    </Section>
  );
}

export function LotPhotosPanelSkeleton() {
  return <Skeleton className="h-64" aria-hidden="true" />;
}
