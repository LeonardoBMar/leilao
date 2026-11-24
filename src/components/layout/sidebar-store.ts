"use client";

const SIDEBAR_STORAGE_KEY = "leilao.sidebar-collapsed";

const sidebarListeners = new Set<() => void>();

export function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

export function getSidebarSnapshot(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function getSidebarServerSnapshot(): boolean {
  return false;
}

export function setSidebarCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Modo privado ou quota excedida: mantém sem quebrar.
  }
  for (const listener of sidebarListeners) {
    listener();
  }
}
