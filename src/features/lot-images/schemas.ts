import { z } from "zod";

import { MAX_IMAGE_BYTES } from "@/domain/lot-images";
import { entityId } from "@/lib/schemas";

export const lotIdSchema = entityId();
export const imageIdSchema = entityId();

const fileName = z.string().trim().min(1).max(255);

/** Pedido de URL de upload: o que o navegador declara sobre o arquivo (conferido de novo depois do envio). */
export const requestUploadSchema = z.object({
  fileName,
  mimeType: z.string().max(100),
  size: z
    .number()
    .int()
    .min(0)
    .max(MAX_IMAGE_BYTES * 2),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

/** Confirmação depois do envio ao Storage. */
export const confirmUploadSchema = z.object({
  path: z.string().max(300),
  fileName,
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const moveDirectionSchema = z.enum(["up", "down"]);
