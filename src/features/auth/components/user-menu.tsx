import { requireUser } from "@/server/auth";

import { UserMenuDropdown } from "./user-menu-dropdown";

/** Conta no header: lê a sessão no servidor e delega o dropdown ao cliente. Renderizar dentro de <Suspense>. */
export async function UserMenu() {
  const user = await requireUser();
  return <UserMenuDropdown email={user.email} devBypass={Boolean(user.devBypass)} />;
}
