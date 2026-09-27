"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { type ActionState, failure, validationError } from "@/lib/action-state";
import { type SignInError, signInWithPassword, signOut } from "@/server/auth";

import { loginInputSchema } from "./schemas";

const SIGN_IN_ERRORS = {
  invalid_credentials: "E-mail ou senha incorretos.",
  rate_limited: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  unavailable: "Não foi possível entrar agora. Tente novamente em instantes.",
} satisfies Record<SignInError, string>;

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, withoutPassword(formData));

  const result = await signInWithPassword(parsed.data.email, parsed.data.password);
  if (!result.ok) return failure(SIGN_IN_ERRORS[result.error], withoutPassword(formData));

  // Caminho validado por nextPathSchema (somente interno).
  redirect(parsed.data.next as Route);
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}

/** A senha nunca volta ao cliente no estado do formulário. */
function withoutPassword(formData: FormData): FormData {
  const copy = new FormData();
  for (const [key, value] of formData) if (key !== "password") copy.append(key, value);
  return copy;
}
