"use client";

import { LayoutGroup, motion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useId } from "react";

import { MOTION_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { tabListClass, tabTriggerClass } from "./tab-styles";

type LinkTab = { href: Route; label: string; active: boolean };

/**
 * Abas que trocam de visão pela URL (ex.: "Por leilão" e "Todos os veículos"), com a mesma aparência de `Tabs`.
 * Aceita props serializáveis vindas de Server Components; a aba ativa leva `aria-current="page"`.
 */
function LinkTabs({
  tabs,
  label,
  className,
  layoutId,
}: {
  tabs: readonly LinkTab[];
  label: string;
  className?: string;
  /** Quando informado, compartilha o indicador entre rotas irmãs; por padrão é isolado por instância. */
  layoutId?: string;
}) {
  const groupId = useId();
  const indicatorId = layoutId ?? `link-tabs-${label}`;

  const content = (
    <nav aria-label={label} className={className}>
      <ul className={tabListClass}>
        {tabs.map((tab) => (
          <li key={tab.label} className="flex">
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(tabTriggerClass, "inline-flex items-center", tab.active && "font-semibold text-foreground")}
            >
              {tab.label}
              {tab.active ? (
                <motion.span
                  aria-hidden="true"
                  layoutId={indicatorId}
                  transition={MOTION_SPRING}
                  className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 bg-foreground"
                />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return layoutId ? content : <LayoutGroup id={groupId}>{content}</LayoutGroup>;
}

export { LinkTabs };
