import { z } from "zod";

/**
 * Variáveis públicas (NEXT_PUBLIC_*), seguras no navegador. Cada uma precisa ser lida pelo nome literal
 * para o Next embuti-la no bundle. Segredos ficam em `src/server/env.ts`.
 */
export const publicEnv = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  })
  .parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
