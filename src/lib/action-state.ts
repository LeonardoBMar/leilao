import { z } from "zod";

/** Mensagens por campo, no formato consumido pelos campos de `@/components/ui`. */
export type FieldErrors = Partial<Record<string, string[]>>;

/**
 * Contrato único de retorno das Server Actions de formulário (usado com `useActionState`).
 * Erros esperados viram `status: "error"`; falhas inesperadas são lançadas para o error boundary.
 * `values` devolve o que foi digitado, porque o React reinicia o formulário após a action.
 */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string; fieldErrors?: FieldErrors; values?: Record<string, string> };

export const idleState: ActionState = { status: "idle" };

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

export function validationError(error: z.ZodError, formData: FormData): ActionState {
  return {
    status: "error",
    message: "Revise os campos destacados.",
    fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
    values: formValues(formData),
  };
}

export function failure(message: string, formData?: FormData): ActionState {
  return formData ? { status: "error", message, values: formValues(formData) } : { status: "error", message };
}

/** Primeira mensagem de um campo, pronta para a prop `error` de Input/Select/Textarea. */
export function fieldError(state: ActionState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}

/** Valor digitado antes do erro, para `defaultValue`. */
export function fieldValue(state: ActionState, field: string): string | undefined {
  return state.status === "error" ? state.values?.[field] : undefined;
}
