import { LogOut, UserRound } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import { requireUser } from "@/server/auth";

import { logoutAction } from "../actions";

/** Conta e saída no rodapé da navegação. Lê a sessão: renderizar dentro de <Suspense>. */
export async function UserMenu() {
  const user = await requireUser();
  const initial = user.email?.trim().charAt(0).toUpperCase() || null;

  return (
    // Coluna que encolhe (minmax(0, 1fr)): sem ela, o e-mail longo alarga a grade e o menu ganha rolagem horizontal.
    <div className="grid grid-cols-1 gap-2">
      {user.devBypass ? (
        <Badge variant="warning" className="mx-2.5 justify-self-start">
          Modo dev: login desligado
        </Badge>
      ) : null}
      <div className="flex items-center gap-2.5 pl-2.5">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-primary-subtle text-caption font-semibold text-foreground-secondary"
        >
          {initial ?? <UserRound className="size-4" />}
        </span>
        <p className="min-w-0 flex-1 truncate text-label text-foreground-secondary" title={user.email ?? undefined}>
          {user.email ?? "Sua conta"}
        </p>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Sair"
            className="text-muted hover:text-foreground"
          >
            <LogOut aria-hidden="true" />
          </Button>
        </form>
      </div>
    </div>
  );
}
