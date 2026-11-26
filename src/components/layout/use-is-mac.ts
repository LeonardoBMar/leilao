"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

function getIsMacSnapshot(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function getIsMacServerSnapshot(): boolean {
  return false;
}

/** Detecta plataforma Apple sem divergência de hidratação para exibir `⌘` ou `Ctrl` nos atalhos. */
export function useIsMac(): boolean {
  return useSyncExternalStore(subscribeNoop, getIsMacSnapshot, getIsMacServerSnapshot);
}
