import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  /** Importação da tabela FIPE e casamento do valor de mercado (D-47, D-51). "off" desliga sem deploy de código. */
  FIPE_LOOKUP: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["on", "off"]).default("on")),
});

function parseEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Lista só os nomes; valores podem conter segredos.
    const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente ausentes ou inválidas: ${keys}. Veja .env.example.`);
  }
  return parsed.data;
}

/** Única fonte de variáveis secretas no servidor. Variáveis públicas: `@/lib/public-env`. */
export const env = parseEnv();
