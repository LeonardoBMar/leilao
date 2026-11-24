import { requireUser } from "@/server/auth";

import { UserMenuDropdown } from "./user-menu-dropdown";

type UserMenuProps = {
  variant?: "header" | "sidebar";
};

/** Conta na casca: lê a sessão no servidor e delega o dropdown ao cliente. Renderizar dentro de <Suspense>. */
export async function UserMenu({ variant = "header" }: UserMenuProps) {
  const user = await requireUser();
  return <UserMenuDropdown email={user.email} devBypass={Boolean(user.devBypass)} variant={variant} />;
}
