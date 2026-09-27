/** Regras das fotos dos lotes (SPEC RF-07). Puras: usadas no navegador (pré-checagem) e no servidor. */

export const MAX_IMAGES_PER_LOT = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageMimeType = keyof typeof IMAGE_TYPES;

export function isImageMimeType(value: string): value is ImageMimeType {
  return Object.hasOwn(IMAGE_TYPES, value);
}

export type ImageCheckError = "unsupported_type" | "too_large" | "empty";

/** Checagem do que o arquivo declara (tipo e tamanho). O conteúdo real é conferido por `detectImageType`. */
export function checkImageFile(file: { type: string; size: number }): ImageCheckError | null {
  if (!isImageMimeType(file.type)) return "unsupported_type";
  if (file.size <= 0) return "empty";
  if (file.size > MAX_IMAGE_BYTES) return "too_large";
  return null;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * Tipo real pela assinatura binária (primeiros 12 bytes), independentemente da extensão ou do tipo declarado.
 * JPEG: FF D8 FF · PNG: 89 50 4E 47 0D 0A 1A 0A · WebP: "RIFF" ???? "WEBP".
 */
export function detectImageType(bytes: Uint8Array): ImageMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}
