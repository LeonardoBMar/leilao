import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { tabActiveClass, tabListClass, tabTriggerClass } from "./tab-styles";

type LinkTab = { href: Route; label: string; active: boolean };

/**
 * Abas que trocam de visão pela URL (ex.: "Por leilão" e "Todos os veículos"), com a mesma aparência de `Tabs`.
 * Seguro em Server Components; a aba ativa leva `aria-current="page"`.
 */
function LinkTabs({ tabs, label, className }: { tabs: readonly LinkTab[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className={tabListClass}>
        {tabs.map((tab) => (
          <li key={tab.label} className="flex">
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(tabTriggerClass, "inline-flex items-center", tab.active && tabActiveClass)}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { LinkTabs };
