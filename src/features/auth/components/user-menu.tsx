import { LogOut } from "lucide-react";

import { Button } from "@/components/ui";
import { requireUser } from "@/server/auth";

import { logoutAction } from "../actions";

/** Conta e saída no rodapé da navegação. Lê a sessão: renderizar dentro de <Suspense>. */
export async function UserMenu() {
  const user = await requireUser();

  return (
    <div className="grid gap-2">
      <p className="truncate px-3 text-caption text-muted" title={user.email ?? undefined}>
        {user.email ?? "Conta"}
      </p>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" className="w-full justify-start">
          <LogOut aria-hidden="true" />
          Sair
        </Button>
      </form>
    </div>
  );
}
