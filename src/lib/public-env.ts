import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/**
 * Variáveis públicas (NEXT_PUBLIC_*), seguras no navegador. Cada uma precisa ser lida pelo nome literal
 * para o Next embuti-la no bundle. Segredos ficam em `src/server/env.ts`.
 * Ausentes → o build falha com a lista de nomes (ex.: deploy de Preview sem variáveis; docs/OPERACAO.md).
 */
function parsePublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Variáveis públicas ausentes ou inválidas: ${keys}. Veja .env.example e docs/OPERACAO.md.`);
  }
  return parsed.data;
}

export const publicEnv = parsePublicEnv();
