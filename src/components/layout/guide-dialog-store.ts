"use client";

const guideListeners = new Set<() => void>();
let guideOpen = false;

export function subscribeGuideDialog(listener: () => void) {
  guideListeners.add(listener);
  return () => {
    guideListeners.delete(listener);
  };
}

export function getGuideDialogSnapshot(): boolean {
  return guideOpen;
}

export function getGuideDialogServerSnapshot(): boolean {
  return false;
}

export function setGuideDialogOpen(next: boolean) {
  if (guideOpen === next) return;
  guideOpen = next;
  for (const listener of guideListeners) {
    listener();
  }
}
