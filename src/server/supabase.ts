import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/public-env";

/**
 * Cliente Supabase do servidor (Auth e Storage), ligado aos cookies da requisição.
 * Criado por chamada: nunca guardar em variável de módulo. Dados de domínio vão pelo Prisma.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components não gravam cookies; o proxy renova a sessão a cada requisição.
        }
      },
    },
  });
}
