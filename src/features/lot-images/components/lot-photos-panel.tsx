import { Section, SectionHeader, SectionTitle, Skeleton } from "@/components/ui";
import { MAX_IMAGES_PER_LOT } from "@/domain/lot-images";

import { listLotImages } from "../queries";
import { LotGallery } from "./lot-gallery";

/** Bloco "Fotos" da ficha do lote (SPEC RF-07). */
export async function LotPhotosPanel({ lotId }: { lotId: string }) {
  const images = await listLotImages(lotId);

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Fotos</SectionTitle>
        <span className="text-caption text-muted tabular-nums">
          {images.length} de {MAX_IMAGES_PER_LOT}
        </span>
      </SectionHeader>
      <LotGallery lotId={lotId} images={images} />
    </Section>
  );
}

export function LotPhotosPanelSkeleton() {
  return <Skeleton className="h-64" aria-hidden="true" />;
}
