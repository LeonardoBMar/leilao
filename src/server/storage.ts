import "server-only";

import { detectImageType, type ImageMimeType } from "@/domain/lot-images";
import { LOT_IMAGES_BUCKET } from "@/lib/storage-buckets";

import { createSupabaseServerClient } from "./supabase";

/**
 * Supabase Storage das fotos dos lotes (D-11, D-20). Usa o cliente com a sessão do usuário: as políticas do
 * bucket (`prisma/sql/storage.sql`) limitam cada operação à pasta do próprio dono, além das checagens da DAL.
 */

/** Validade das URLs de leitura exibidas na galeria (SPEC §11: URLs temporárias). */
const SIGNED_URL_SECONDS = 60 * 60;
const INSPECT_TIMEOUT_MS = 10_000;
const HEADER_BYTES = 16;

async function bucket() {
  const supabase = await createSupabaseServerClient();
  return supabase.storage.from(LOT_IMAGES_BUCKET);
}

/** URL assinada para o navegador enviar o arquivo direto ao Storage, sem passar pelo servidor. */
export async function createUploadUrl(path: string): Promise<{ path: string; token: string } | null> {
  const { data, error } = await (await bucket()).createSignedUploadUrl(path);
  if (error) {
    console.error("Storage: falha ao criar URL de upload", error.message);
    return null;
  }
  return { path: data.path, token: data.token };
}

export type UploadedImage = { size: number; declaredType: string | null; detectedType: ImageMimeType | null };

/**
 * Confere o arquivo que chegou ao Storage antes de registrá-lo: tamanho, tipo gravado e assinatura binária dos
 * primeiros bytes (SPEC RF-07: validar conteúdo, tipo e tamanho no servidor). `null` se o objeto não existe.
 */
export async function inspectUpload(path: string): Promise<UploadedImage | null> {
  const storage = await bucket();
  const { data: info, error } = await storage.info(path);
  if (error) return null;

  const { data: signed } = await storage.createSignedUrl(path, 60);
  let detectedType: ImageMimeType | null = null;
  if (signed) {
    try {
      const response = await fetch(signed.signedUrl, {
        headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
        cache: "no-store",
        signal: AbortSignal.timeout(INSPECT_TIMEOUT_MS),
      });
      if (response.ok) detectedType = detectImageType(await readHeaderBytes(response));
    } catch (fetchError) {
      console.error("Storage: falha ao inspecionar assinatura binária", fetchError);
      return null;
    }
  }

  return { size: info.size ?? 0, declaredType: info.contentType ?? null, detectedType };
}

/** Lê no máximo `HEADER_BYTES` do stream, mesmo se o servidor ignorar o cabeçalho `Range`. */
async function readHeaderBytes(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const buffer = new Uint8Array(HEADER_BYTES);
  let offset = 0;
  try {
    while (offset < HEADER_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, HEADER_BYTES - offset);
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return buffer.subarray(0, offset);
}

/** URLs temporárias de leitura, na mesma ordem dos caminhos. Falha vira `null` (a galeria mostra aviso). */
export async function signedImageUrls(paths: readonly string[]): Promise<(string | null)[]> {
  if (paths.length === 0) return [];
  const { data, error } = await (await bucket()).createSignedUrls([...paths], SIGNED_URL_SECONDS);
  if (error) {
    console.error("Storage: falha ao assinar URLs", error.message);
    return paths.map(() => null);
  }
  const byPath = new Map(data.map((item) => [item.path, item.error ? null : item.signedUrl]));
  return paths.map((path) => byPath.get(path) ?? null);
}

/** Remove arquivos. Falha é registrada e não interrompe a operação no banco (o arquivo órfão não é exibido). */
export async function removeObjects(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await (await bucket()).remove([...paths]);
  if (error) console.error("Storage: falha ao remover arquivos", error.message);
}
