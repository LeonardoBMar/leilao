"use client";

import { useActionState } from "react";

import { Alert, AlertDescription, Button, Input } from "@/components/ui";
import { fieldError, fieldValue, idleState } from "@/lib/action-state";

import { loginAction } from "../actions";

type LoginFormProps = {
  next?: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, idleState);

  return (
    <form action={formAction} className="grid gap-4">
      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Input
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        required
        autoFocus
        defaultValue={fieldValue(state, "email")}
        error={fieldError(state, "email")}
      />
      <Input
        name="password"
        type="password"
        label="Senha"
        autoComplete="current-password"
        required
        error={fieldError(state, "password")}
      />
      <Button type="submit" className="mt-2 w-full" loading={pending} loadingLabel="Entrando…">
        Entrar
      </Button>
    </form>
  );
}
