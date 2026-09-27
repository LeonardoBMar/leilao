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
    const response = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
    if (response.ok) detectedType = detectImageType(new Uint8Array(await response.arrayBuffer()));
  }

  return { size: info.size ?? 0, declaredType: info.contentType ?? null, detectedType };
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
