import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { err, ok, type Result } from "@/lib/result";

import { createSupabaseServerClient } from "./supabase";

export type SessionUser = { id: string; email: string | null };

/**
 * Usuário da sessão, validado uma vez por requisição. `getClaims()` verifica a assinatura do JWT
 * (nunca confiar em `getSession()` no servidor). Lê cookies: chamar dentro de <Suspense>.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
});

/** Barreira de autenticação da DAL: toda query e mutation começa por aqui. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type SignInError = "invalid_credentials" | "rate_limited" | "unavailable";

export async function signInWithPassword(email: string, password: string): Promise<Result<null, SignInError>> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return ok(null);

  switch (error.code) {
    case "invalid_credentials":
    case "email_not_confirmed":
    case "user_banned":
      return err("invalid_credentials");
    case "over_request_rate_limit":
      return err("rate_limited");
    default:
      console.error("Falha no login:", error.code ?? error.status);
      return err("unavailable");
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
