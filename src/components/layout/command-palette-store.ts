"use client";

import type { Route } from "next";
import { useEffect } from "react";

export type QuickJumpItem = {
  href: Route;
  label: string;
  meta?: string;
  keywords?: string;
};

const EMPTY_ITEMS: readonly QuickJumpItem[] = [];

let currentItems: readonly QuickJumpItem[] = EMPTY_ITEMS;
const listeners = new Set<() => void>();

export function subscribeCommandItems(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCommandItemsSnapshot(): readonly QuickJumpItem[] {
  return currentItems;
}

export function getCommandItemsServerSnapshot(): readonly QuickJumpItem[] {
  return EMPTY_ITEMS;
}

function publishCommandItems(items: readonly QuickJumpItem[]) {
  currentItems = items;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Ponte declarativa entre Server Components em `<Suspense>` e a `CommandPalette` (D-87).
 * Atualiza a store externa via `useSyncExternalStore` sem bloquear a casca nem violar fronteiras de camada.
 */
export function CommandPaletteItems({ items }: { items: readonly QuickJumpItem[] }) {
  useEffect(() => {
    publishCommandItems(items);
    return () => {
      if (currentItems === items) publishCommandItems(EMPTY_ITEMS);
    };
  }, [items]);

  return null;
}
