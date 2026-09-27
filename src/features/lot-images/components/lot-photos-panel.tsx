import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";

import { listLotImages } from "../queries";
import { LotGallery } from "./lot-gallery";

/** Bloco "Fotos" da ficha do lote (SPEC RF-07). */
export async function LotPhotosPanel({ lotId }: { lotId: string }) {
  const images = await listLotImages(lotId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotos</CardTitle>
      </CardHeader>
      <CardContent>
        <LotGallery lotId={lotId} images={images} />
      </CardContent>
    </Card>
  );
}

export function LotPhotosPanelSkeleton() {
  return <Skeleton className="h-64" aria-hidden="true" />;
}
