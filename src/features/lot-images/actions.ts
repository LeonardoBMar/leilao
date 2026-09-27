"use server";

import { refresh } from "next/cache";

import { MAX_IMAGES_PER_LOT } from "@/domain/lot-images";
import { type ActionState, failure } from "@/lib/action-state";

import {
  confirmImageUpload,
  type ConfirmUploadError,
  deleteImage,
  type ImageError,
  moveImage,
  requestImageUpload,
  type RequestUploadError,
  setCoverImage,
} from "./mutations";
import { confirmUploadSchema, imageIdSchema, lotIdSchema, moveDirectionSchema, requestUploadSchema } from "./schemas";

const LIMIT = `Cada lote aceita até ${MAX_IMAGES_PER_LOT} fotos.`;

const REQUEST_ERRORS = {
  lot_not_found: "Lote não encontrado.",
  limit_reached: LIMIT,
  storage_unavailable: "Não foi possível preparar o envio agora. Tente novamente.",
  unsupported_type: "Formato não aceito. Envie JPEG, PNG ou WebP.",
  too_large: "A foto passa de 5 MB.",
  empty: "O arquivo está vazio.",
} satisfies Record<RequestUploadError, string>;

const CONFIRM_ERRORS = {
  lot_not_found: "Lote não encontrado.",
  invalid_path: "Envio inválido.",
  not_uploaded: "O arquivo não chegou ao armazenamento. Tente novamente.",
  invalid_file: "O conteúdo do arquivo não é uma imagem JPEG, PNG ou WebP válida de até 5 MB.",
  limit_reached: LIMIT,
} satisfies Record<ConfirmUploadError, string>;

const IMAGE_ERRORS = { not_found: "Foto não encontrada." } satisfies Record<ImageError, string>;

type UploadTicket = { status: "ready"; path: string; token: string } | Extract<ActionState, { status: "error" }>;

/** Passo 1: autoriza o envio e devolve a URL assinada (o arquivo não passa pelo servidor; D-11). */
export async function requestImageUploadAction(lotId: string, file: unknown): Promise<UploadTicket> {
  const parsedLot = lotIdSchema.safeParse(lotId);
  const parsed = requestUploadSchema.safeParse(file);
  if (!parsedLot.success) return { status: "error", message: REQUEST_ERRORS.lot_not_found };
  if (!parsed.success) return { status: "error", message: REQUEST_ERRORS.unsupported_type };

  const result = await requestImageUpload(parsedLot.data, parsed.data);
  if (!result.ok) return { status: "error", message: REQUEST_ERRORS[result.error] };
  return { status: "ready", ...result.value };
}

/** Passo 2: depois do envio, confere o arquivo real e registra a foto. */
export async function confirmImageUploadAction(lotId: string, upload: unknown): Promise<ActionState> {
  const parsedLot = lotIdSchema.safeParse(lotId);
  const parsed = confirmUploadSchema.safeParse(upload);
  if (!parsedLot.success || !parsed.success) return failure(CONFIRM_ERRORS.invalid_path);

  const result = await confirmImageUpload(parsedLot.data, parsed.data);
  if (!result.ok) return failure(CONFIRM_ERRORS[result.error]);

  refresh();
  return { status: "success" };
}

export async function setCoverImageAction(imageId: string): Promise<ActionState> {
  const parsed = imageIdSchema.safeParse(imageId);
  if (!parsed.success) return failure(IMAGE_ERRORS.not_found);
  const result = await setCoverImage(parsed.data);
  if (!result.ok) return failure(IMAGE_ERRORS[result.error]);
  refresh();
  return { status: "success", message: "Capa definida." };
}

export async function moveImageAction(imageId: string, direction: string): Promise<ActionState> {
  const parsed = imageIdSchema.safeParse(imageId);
  const parsedDirection = moveDirectionSchema.safeParse(direction);
  if (!parsed.success || !parsedDirection.success) return failure(IMAGE_ERRORS.not_found);
  const result = await moveImage(parsed.data, parsedDirection.data);
  if (!result.ok) return failure(IMAGE_ERRORS[result.error]);
  refresh();
  return { status: "success" };
}

export async function deleteImageAction(imageId: string): Promise<ActionState> {
  const parsed = imageIdSchema.safeParse(imageId);
  if (!parsed.success) return failure(IMAGE_ERRORS.not_found);
  const result = await deleteImage(parsed.data);
  if (!result.ok) return failure(IMAGE_ERRORS[result.error]);
  refresh();
  return { status: "success", message: "Foto removida." };
}
