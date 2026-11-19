import "server-only";

import {
  checkImageFile,
  IMAGE_TYPES,
  type ImageCheckError,
  isImageMimeType,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_LOT,
} from "@/domain/lot-images";
import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db, isUniqueViolation } from "@/server/db";
import { createUploadUrl, inspectUpload, removeObjects } from "@/server/storage";

import type { ConfirmUploadInput, RequestUploadInput } from "./schemas";

export type RequestUploadError = "lot_not_found" | "limit_reached" | "storage_unavailable" | ImageCheckError;

/**
 * Autoriza um envio (D-11): confere dono, limite de fotos, tipo e tamanho declarados e devolve uma URL assinada
 * para o navegador enviar direto ao Storage, numa pasta exclusiva do dono e do lote.
 */
export async function requestImageUpload(
  lotId: string,
  file: RequestUploadInput,
): Promise<Result<{ path: string; token: string }, RequestUploadError>> {
  const user = await requireUser();
  const lot = await db.lot.findFirst({
    where: { id: lotId, ownerId: user.id },
    select: { _count: { select: { images: true } } },
  });
  if (!lot) return err("lot_not_found");
  if (lot._count.images >= MAX_IMAGES_PER_LOT) return err("limit_reached");

  const problem = checkImageFile({ type: file.mimeType, size: file.size });
  if (problem) return err(problem);
  if (!isImageMimeType(file.mimeType)) return err("unsupported_type");

  const path = `${user.id}/${lotId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.mimeType]}`;
  const upload = await createUploadUrl(path);
  return upload ? ok(upload) : err("storage_unavailable");
}

export type ConfirmUploadError = "lot_not_found" | "invalid_path" | "not_uploaded" | "invalid_file" | "limit_reached";

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

async function insertLotImage(
  lotId: string,
  ownerId: string,
  input: ConfirmUploadInput,
  mimeType: string,
  sizeBytes: number,
  forceNotCover = false,
): Promise<"ok" | "limit_reached"> {
  return db.$transaction(async (tx) => {
    const images = await tx.lotImage.findMany({
      where: { lotId, ownerId },
      select: { sortOrder: true, isCover: true },
    });
    if (images.length >= MAX_IMAGES_PER_LOT) return "limit_reached";

    await tx.lotImage.create({
      data: {
        ownerId,
        lotId,
        storagePath: input.path,
        originalFilename: input.fileName,
        mimeType,
        sizeBytes,
        sortOrder: images.reduce((max, image) => Math.max(max, image.sortOrder + 1), 0),
        // A primeira foto vira capa automaticamente, salvo em retentativa após corrida pela capa.
        isCover: forceNotCover ? false : !images.some((image) => image.isCover),
      },
    });
    return "ok";
  });
}

/**
 * Registra a foto depois de conferir o arquivo que realmente chegou ao Storage (tamanho, tipo e assinatura
 * binária). Arquivo inválido é removido e nada é registrado (SPEC §11, CA-18).
 */
export async function confirmImageUpload(
  lotId: string,
  input: ConfirmUploadInput,
): Promise<Result<null, ConfirmUploadError>> {
  const user = await requireUser();
  // Só caminhos que este mesmo fluxo emitiria: pasta do dono e do lote, nome UUID e extensão permitida.
  const expected = new RegExp(`^${user.id}/${lotId}/${UUID_PATTERN}\\.(jpg|png|webp)$`);
  if (!expected.test(input.path)) return err("invalid_path");

  const lot = await db.lot.findFirst({ where: { id: lotId, ownerId: user.id }, select: { id: true } });
  if (!lot) return err("lot_not_found");

  const uploaded = await inspectUpload(input.path);
  if (!uploaded) return err("not_uploaded");

  const isValid =
    uploaded.detectedType !== null &&
    uploaded.declaredType === uploaded.detectedType &&
    input.path.endsWith(`.${IMAGE_TYPES[uploaded.detectedType]}`) &&
    uploaded.size > 0 &&
    uploaded.size <= MAX_IMAGE_BYTES;
  if (!isValid || uploaded.detectedType === null) {
    await removeObjects([input.path]);
    return err("invalid_file");
  }
  const mimeType = uploaded.detectedType;

  try {
    const outcome = await insertLotImage(lotId, user.id, input, mimeType, uploaded.size);
    if (outcome === "limit_reached") {
      await removeObjects([input.path]);
      return err("limit_reached");
    }
    return ok(null);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await db.lotImage.findFirst({
      where: { storagePath: input.path, ownerId: user.id },
      select: { id: true },
    });
    // Confirmação repetida do mesmo arquivo (`storage_path` único): já está registrado.
    if (existing) return ok(null);

    // Colisão concorrente pela capa única (`lot_images_one_cover_per_lot`): registra como foto comum.
    try {
      const retry = await insertLotImage(lotId, user.id, input, mimeType, uploaded.size, true);
      if (retry === "limit_reached") {
        await removeObjects([input.path]);
        return err("limit_reached");
      }
      return ok(null);
    } catch (retryError) {
      if (isUniqueViolation(retryError)) return ok(null);
      throw retryError;
    }
  }
}

export type ImageError = "not_found";

/** Define a capa (no máximo uma por lote, garantido por índice único parcial). */
export async function setCoverImage(imageId: string): Promise<Result<null, ImageError>> {
  const user = await requireUser();
  const image = await db.lotImage.findFirst({ where: { id: imageId, ownerId: user.id }, select: { lotId: true } });
  if (!image) return err("not_found");

  await db.$transaction([
    db.lotImage.updateMany({
      where: { lotId: image.lotId, ownerId: user.id, isCover: true },
      data: { isCover: false },
    }),
    db.lotImage.updateMany({ where: { id: imageId, ownerId: user.id }, data: { isCover: true } }),
  ]);
  return ok(null);
}

/** Troca a posição da foto com a vizinha (ordem da galeria). */
export async function moveImage(imageId: string, direction: "up" | "down"): Promise<Result<null, ImageError>> {
  const user = await requireUser();
  const image = await db.lotImage.findFirst({ where: { id: imageId, ownerId: user.id }, select: { lotId: true } });
  if (!image) return err("not_found");

  const images = await db.lotImage.findMany({
    where: { lotId: image.lotId, ownerId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = images.findIndex((item) => item.id === imageId);
  const target = direction === "up" ? index - 1 : index + 1;
  const neighbor = images[target];
  if (index < 0 || !neighbor) return ok(null);

  // Renumera toda a galeria (0..n-1) com a troca aplicada: ordem estável mesmo com valores repetidos.
  const reordered = images.map((item) => item.id);
  reordered[index] = neighbor.id;
  reordered[target] = imageId;
  await db.$transaction(
    reordered.map((id, sortOrder) => db.lotImage.updateMany({ where: { id, ownerId: user.id }, data: { sortOrder } })),
  );
  return ok(null);
}

/** Remove a foto do banco e depois o arquivo. Se era a capa, a próxima da galeria assume. */
export async function deleteImage(imageId: string): Promise<Result<null, ImageError>> {
  const user = await requireUser();
  const deleted = await db.$transaction(async (tx) => {
    const image = await tx.lotImage.findFirst({
      where: { id: imageId, ownerId: user.id },
      select: { lotId: true, storagePath: true, isCover: true },
    });
    if (!image) return null;

    await tx.lotImage.deleteMany({ where: { id: imageId, ownerId: user.id } });
    if (image.isCover) {
      const next = await tx.lotImage.findFirst({
        where: { lotId: image.lotId, ownerId: user.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (next) await tx.lotImage.updateMany({ where: { id: next.id, ownerId: user.id }, data: { isCover: true } });
    }
    return image.storagePath;
  });
  if (!deleted) return err("not_found");

  // Depois do banco: se o Storage falhar, sobra um arquivo órfão, nunca um registro apontando para o nada.
  await removeObjects([deleted]);
  return ok(null);
}
