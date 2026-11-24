import { LinkTabs } from "@/components/ui";
import { isCurrentUserAdmin } from "@/server/auth";

export function SystemTabs({ active }: { active: "collector" | "fipe" | "preferences" }) {
  return (
    <LinkTabs
      label="Seções do sistema"
      layoutId="system-tabs"
      tabs={[
        { href: "/sistema", label: "Coleta", active: active === "collector" },
        { href: "/sistema/fipe", label: "Correções FIPE", active: active === "fipe" },
        { href: "/sistema/preferencias", label: "Preferências", active: active === "preferences" },
      ]}
    />
  );
}

/** Exibe as abas de Sistema apenas para administradores (evita links bloqueados em Preferências). Renderizar em `<Suspense>`. */
export async function AdminSystemTabs({ active }: { active: "collector" | "fipe" | "preferences" }) {
  if (!(await isCurrentUserAdmin())) return null;
  return <SystemTabs active={active} />;
}
