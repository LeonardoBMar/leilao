import "server-only";

import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { signedImageUrls } from "@/server/storage";

export type LotImageItem = {
  id: string;
  /** URL temporária de leitura; `null` quando o arquivo não pôde ser assinado. */
  url: string | null;
  originalFilename: string;
  isCover: boolean;
  sizeBytes: number;
};

/** Galeria do lote na ordem definida pelo usuário, com URLs assinadas de curta duração (SPEC §11). */
export async function listLotImages(lotId: string): Promise<LotImageItem[]> {
  const user = await requireUser();
  const rows = await db.lotImage.findMany({
    where: { lotId, ownerId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, storagePath: true, originalFilename: true, isCover: true, sizeBytes: true },
  });
  const urls = await signedImageUrls(rows.map((row) => row.storagePath));
  return rows.map(({ storagePath: _path, ...row }, index) => ({ ...row, url: urls[index] ?? null }));
}

/** URLs das fotos do anúncio coletado ligado ao lote (D-29), sem cópia no Storage. */
export async function listLotListingPhotos(lotId: string): Promise<string[]> {
  const user = await requireUser();
  const lot = await db.lot.findFirst({
    where: { id: lotId, ownerId: user.id },
    select: { listing: { select: { photoUrls: true } } },
  });
  return Array.from(new Set(lot?.listing?.photoUrls ?? []));
}
