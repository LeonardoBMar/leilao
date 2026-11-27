import "server-only";

import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/lib/public-env";

import type { SessionUser } from "./auth";

/**
 * Autenticação da API v1 via `Authorization: Bearer <access_token>` (ARCHITECTURE §17, D-98).
 * Nunca aceita cookie de sessão (elimina CSRF em clientes externos e automações).
 */

export const API_V1_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
} as const;

const BEARER_RE = /^Bearer\s+(.+)$/i;

export function apiError(
  status: number,
  code: string,
  message: string,
  extra?: { fields?: Record<string, string[]>; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(extra?.fields ? { fields: extra.fields } : {}),
      },
    },
    { status, headers: { ...API_V1_HEADERS, ...extra?.headers } },
  );
}

export async function authenticateBearerRequest(
  request: NextRequest,
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  const match = authHeader ? BEARER_RE.exec(authHeader.trim()) : null;
  if (!match?.[1]) {
    return {
      ok: false,
      response: apiError(401, "unauthenticated", "Informe o cabeçalho Authorization: Bearer <token>."),
    };
  }

  const token = match[1].trim();
  if (token.length < 20) {
    return {
      ok: false,
      response: apiError(401, "unauthenticated", "Token de acesso inválido ou expirado."),
    };
  }

  const supabase = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return {
        ok: false,
        response: apiError(401, "unauthenticated", "Token de acesso inválido ou expirado."),
      };
    }

    return {
      ok: true,
      user: { id: data.user.id, email: data.user.email ?? null },
    };
  } catch (error) {
    console.error("Falha ao validar token Bearer:", error instanceof Error ? error.message : "unknown");
    return {
      ok: false,
      response: apiError(500, "internal_error", "Não foi possível validar a autenticação agora."),
    };
  }
}
