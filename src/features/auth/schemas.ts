import { z } from "zod";

export const DEFAULT_AFTER_LOGIN = "/dashboard";

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

function isSafeInternalNext(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\") || CONTROL_CHARS.test(path)) {
    return false;
  }
  try {
    const parsed = new URL(path, "http://local.invalid");
    return parsed.origin === "http://local.invalid" && !parsed.pathname.startsWith("/login");
  } catch {
    return false;
  }
}

/**
 * Destino após o login. Só caminhos internos: rejeita URLs absolutas, `//host`, caracteres de controle
 * e redirecionamento em loop para `/login` (open redirect).
 */
export const nextPathSchema = z.string().refine(isSafeInternalNext).catch(DEFAULT_AFTER_LOGIN);

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe a senha."),
  next: nextPathSchema.optional().default(DEFAULT_AFTER_LOGIN),
});
export type LoginInput = z.infer<typeof loginInputSchema>;
