import { LinkTabs } from "@/components/ui";

export function SystemTabs({ active }: { active: "collector" | "fipe" }) {
  return (
    <LinkTabs
      label="Seções do sistema"
      layoutId="system-tabs"
      tabs={[
        { href: "/sistema", label: "Coleta", active: active === "collector" },
        { href: "/sistema/fipe", label: "Correções FIPE", active: active === "fipe" },
      ]}
    />
  );
}
