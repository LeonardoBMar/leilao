import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "./public-env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Cliente Supabase do navegador, usado só para enviar arquivos com URL assinada (D-11). Dados de domínio nunca
 * passam por aqui: leitura e escrita são feitas no servidor.
 */
export function getSupabaseBrowserClient() {
  client ??= createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return client;
}
