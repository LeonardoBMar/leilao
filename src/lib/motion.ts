import type { Transition } from "motion/react";

/** Curva de desaceleração precisa (emil-design-eng: --ease-out, sem overshoot perceptível). */
export const MOTION_EASE = [0.23, 1, 0.32, 1] as const;

/** Mola rápida e amortecida para indicadores compartilhados (`layoutId`) e FLIP de posição. */
export const MOTION_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 38,
  mass: 1,
} as const satisfies Transition;

/** Entrada curta apenas com propriedades compostas (`transform`, `opacity`). */
export const MOTION_ENTER_TRANSITION = {
  duration: 0.2,
  ease: MOTION_EASE,
} as const satisfies Transition;

/** Saída mais rápida que a entrada para liberar espaço sem sensação de lentidão. */
export const MOTION_EXIT_TRANSITION = {
  duration: 0.14,
  ease: MOTION_EASE,
} as const satisfies Transition;

/** Transição combinada para itens em listas/chips com FLIP de posição. */
export const MOTION_LAYOUT_TRANSITION = {
  layout: MOTION_SPRING,
  opacity: MOTION_ENTER_TRANSITION,
  scale: MOTION_ENTER_TRANSITION,
  y: MOTION_ENTER_TRANSITION,
} as const satisfies Transition;
