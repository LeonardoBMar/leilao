import { AdminRoleSync } from "@/components/layout/admin-role-store";
import { isCurrentUserAdmin } from "@/server/auth";

/** Resolve o papel `ADMIN` dentro de `<Suspense>` sem bloquear a casca estática do layout privado. */
export async function AdminRoleBridge() {
  const isAdmin = await isCurrentUserAdmin();
  return <AdminRoleSync isAdmin={isAdmin} />;
}
