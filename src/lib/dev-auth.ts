import { z } from "zod";

/**
 * Login desligado no desenvolvimento local (D-31), para conferir telas sem digitar senha.
 * Vale só quando TODAS as travas passam:
 * - `NODE_ENV=development` (em build de produção nunca vale);
 * - `DEV_AUTH_BYPASS=true` e `DEV_AUTH_USER_ID` (UUID do usuário de testes) no `.env.local`;
 * - servidor iniciado por `npm run dev:local`, que escuta só em 127.0.0.1 e define `DEV_AUTH_LOOPBACK=1`
 *   (`npm run dev` escuta na rede local e segue exigindo login);
 * - requisição endereçada ao próprio computador.
 * Mesmo ligado, a DAL continua filtrando por dono: o app age como esse usuário.
 */
type DevAuthEnv = {
  NODE_ENV?: string;
  DEV_AUTH_BYPASS?: string;
  DEV_AUTH_USER_ID?: string;
  DEV_AUTH_LOOPBACK?: string;
};

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const userIdSchema = z.uuid();

/** Id do usuário a assumir sem login, ou `null` (o normal: login exigido). */
export function devAuthUserId(env: DevAuthEnv, host: string | null): string | null {
  if (env.NODE_ENV !== "development" || env.DEV_AUTH_BYPASS !== "true" || env.DEV_AUTH_LOOPBACK !== "1") return null;
  if (!host || !LOOPBACK_HOSTNAMES.has(hostnameOf(host))) return null;
  const parsed = userIdSchema.safeParse(env.DEV_AUTH_USER_ID);
  return parsed.success ? parsed.data : null;
}

/** Cabeçalho Host sem a porta ("[::1]:3100" → "[::1]"). */
function hostnameOf(host: string): string {
  const value = host.trim().toLowerCase();
  if (value.startsWith("[")) return value.slice(0, value.indexOf("]") + 1);
  return value.split(":")[0] ?? value;
}
