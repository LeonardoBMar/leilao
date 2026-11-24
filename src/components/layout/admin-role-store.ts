"use client";

import { useEffect } from "react";

let currentIsAdmin = false;
const listeners = new Set<() => void>();

export function subscribeAdminRole(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAdminRoleSnapshot(): boolean {
  return currentIsAdmin;
}

export function getAdminRoleServerSnapshot(): boolean {
  return false;
}

function publishAdminRole(isAdmin: boolean) {
  if (currentIsAdmin === isAdmin) return;
  currentIsAdmin = isAdmin;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Ponte declarativa entre Server Component em `<Suspense>` e a casca cliente (mesmo padrão de `command-palette-store`).
 * Falha fechada (`false`) no pré-render para nunca expor links administrativos a usuários comuns.
 */
export function AdminRoleSync({ isAdmin }: { isAdmin: boolean }) {
  useEffect(() => {
    publishAdminRole(isAdmin);
    return () => {
      publishAdminRole(false);
    };
  }, [isAdmin]);

  return null;
}
