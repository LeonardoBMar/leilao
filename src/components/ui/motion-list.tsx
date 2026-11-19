"use client";

import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { useId } from "react";

import { MOTION_EXIT_TRANSITION, MOTION_LAYOUT_TRANSITION } from "@/lib/motion";
import { cn } from "@/lib/utils";

type MotionListProps = {
  as?: "ul" | "ol";
  "aria-label"?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Lista com FLIP de posição e saída suave (`AnimatePresence mode="popLayout"`).
 * `initial={false}` evita animação no primeiro render (SSR/hidratação).
 */
function MotionList({ as = "ul", "aria-label": ariaLabel, className, children }: MotionListProps) {
  const groupId = useId();
  const Tag = as;

  return (
    <LayoutGroup id={groupId}>
      <Tag aria-label={ariaLabel} className={cn("relative", className)}>
        <AnimatePresence mode="popLayout" initial={false}>
          {children}
        </AnimatePresence>
      </Tag>
    </LayoutGroup>
  );
}

type MotionListItemProps = {
  variant?: "item" | "chip";
  className?: string;
  children: React.ReactNode;
};

const ITEM_STATES = {
  item: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: MOTION_EXIT_TRANSITION },
  },
  chip: {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.94, transition: MOTION_EXIT_TRANSITION },
  },
} as const;

/**
 * Item de `MotionList`: usa `layout="position"` para deslizar sem distorcer texto ou `border-radius`.
 */
function MotionListItem({ variant = "item", className, children }: MotionListItemProps) {
  const states = ITEM_STATES[variant];

  return (
    <m.li
      layout="position"
      initial={states.initial}
      animate={states.animate}
      exit={states.exit}
      transition={MOTION_LAYOUT_TRANSITION}
      className={className}
    >
      {children}
    </m.li>
  );
}

export { MotionList, MotionListItem };
