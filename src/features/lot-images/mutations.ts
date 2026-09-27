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
  const expected = new RegExp(`^${user.id}/${lotId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);
  if (!expected.test(input.path)) return err("invalid_path");

  const lot = await db.lot.findFirst({ where: { id: lotId, ownerId: user.id }, select: { id: true } });
  if (!lot) return err("lot_not_found");

  const uploaded = await inspectUpload(input.path);
  if (!uploaded) return err("not_uploaded");

  const isValid =
    uploaded.detectedType !== null &&
    uploaded.declaredType === uploaded.detectedType &&
    uploaded.size > 0 &&
    uploaded.size <= MAX_IMAGE_BYTES;
  if (!isValid || uploaded.detectedType === null) {
    await removeObjects([input.path]);
    return err("invalid_file");
  }
  const mimeType = uploaded.detectedType;

  try {
    const outcome = await db.$transaction(async (tx) => {
      const images = await tx.lotImage.findMany({
        where: { lotId, ownerId: user.id },
        select: { sortOrder: true, isCover: true },
      });
      if (images.length >= MAX_IMAGES_PER_LOT) return "limit_reached" as const;

      await tx.lotImage.create({
        data: {
          ownerId: user.id,
          lotId,
          storagePath: input.path,
          originalFilename: input.fileName,
          mimeType,
          sizeBytes: uploaded.size,
          sortOrder: images.reduce((max, image) => Math.max(max, image.sortOrder + 1), 0),
          // A primeira foto vira capa automaticamente.
          isCover: !images.some((image) => image.isCover),
        },
      });
      return "ok" as const;
    });
    if (outcome === "limit_reached") {
      await removeObjects([input.path]);
      return err("limit_reached");
    }
    return ok(null);
  } catch (error) {
    // Confirmação repetida do mesmo arquivo (storage_path único): já está registrado.
    if (isUniqueViolation(error)) return ok(null);
    throw error;
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
  const image = await db.lotImage.findFirst({
    where: { id: imageId, ownerId: user.id },
    select: { lotId: true, storagePath: true, isCover: true },
  });
  if (!image) return err("not_found");

  await db.$transaction(async (tx) => {
    await tx.lotImage.deleteMany({ where: { id: imageId, ownerId: user.id } });
    if (!image.isCover) return;
    const next = await tx.lotImage.findFirst({
      where: { lotId: image.lotId, ownerId: user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (next) await tx.lotImage.updateMany({ where: { id: next.id }, data: { isCover: true } });
  });
  // Depois do banco: se o Storage falhar, sobra um arquivo órfão, nunca um registro apontando para o nada.
  await removeObjects([image.storagePath]);
  return ok(null);
}
