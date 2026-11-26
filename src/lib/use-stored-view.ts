"use client";

import { useSyncExternalStore } from "react";

// A small per-device preference (which way a list is organized), remembered in
// the browser. Reading or writing can fail (private window, blocked storage);
// then the default is used and nothing breaks.
const EVENT = "gol:stored-view";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useStoredView<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (value: T) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const value = stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback;

  const set = (next: T) => {
    try {
      window.localStorage.setItem(key, next);
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [value, set];
}
