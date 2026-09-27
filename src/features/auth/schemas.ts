import { z } from "zod";

export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Destino após o login. Só caminhos internos: rejeita URLs absolutas e `//host`,
 * que permitiriam redirecionar o usuário para outro site (open redirect).
 */
export const nextPathSchema = z
  .string()
  .refine((path) => path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\"))
  .catch(DEFAULT_AFTER_LOGIN);

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe a senha."),
  next: nextPathSchema.optional().default(DEFAULT_AFTER_LOGIN),
});
export type LoginInput = z.infer<typeof loginInputSchema>;
