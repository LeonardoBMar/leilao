import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { type UserRole } from "@/generated/prisma/client";
import { devAuthUserId } from "@/lib/dev-auth";
import { err, ok, type Result } from "@/lib/result";

import { db } from "./db";
import { createSupabaseServerClient } from "./supabase";

/** `devBypass`: sessão assumida sem login no desenvolvimento local (D-31). */
export type SessionUser = { id: string; email: string | null; devBypass?: true };

/**
 * Usuário da sessão, validado uma vez por requisição. `getClaims()` verifica a assinatura do JWT
 * (nunca confiar em `getSession()` no servidor). Lê cookies: chamar dentro de <Suspense>.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const devUserId = devAuthUserId(process.env, (await headers()).get("host"));
  if (devUserId) return { id: devUserId, email: null, devBypass: true };

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

/**
 * Papel do usuário no banco, consultado uma vez por requisição (`React.cache`).
 * Usuários sem linha em `user_profiles` são tratados como `USER` (D-90).
 */
export const getUserRole = cache(async (userId: string): Promise<UserRole> => {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { role: true },
  });
  return profile?.role ?? "USER";
});

/** Barreira administrativa da DAL: exige sessão autenticada e papel `ADMIN` em `user_profiles` (D-90). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  const role = await getUserRole(user.id);
  if (role !== "ADMIN") redirect("/dashboard");
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
  // Só esta sessão: sair no celular não desconecta o computador.
  await supabase.auth.signOut({ scope: "local" });
}
