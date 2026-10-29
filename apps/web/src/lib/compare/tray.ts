"use client";

import { useCallback, useSyncExternalStore } from "react";
import { COMPARE_MAX, parseIds, toggled } from "./ids";

export { COMPARE_MAX, compareHref, parseIds, toggled } from "./ids";

/**
 * THE COMPARE TRAY'S MEMORY (backlog row 7, 29 October 2026): up to four
 * listing ids the reader has set aside to compare, kept on this device.
 *
 * Device-only on purpose: comparing is a thing you do while looking, not a
 * record about you, so it needs no account, no table and no sign-in, and a
 * guest can use it. The Saved page's shortlist is the account's memory; this
 * is the reader's hand. `/compare` reads the ids it is handed in the address,
 * never this store, so a compare link can be sent to somebody else.
 *
 * Everything is defensive: storage may be missing or blocked (private mode,
 * a locked-down webview), and a stored value is untrusted text.
 */

const KEY = "vallo.compare.v1";

const listeners = new Set<() => void>();
const EMPTY: string[] = [];
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function snapshot(): string[] {
  const raw = readRaw();
  if (raw === cache.raw) return cache.ids;
  const ids = parseIds(raw);
  cache = { raw, ids: ids.length === 0 ? EMPTY : ids };
  return cache.ids;
}

function write(ids: string[]): void {
  try {
    if (ids.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* Storage blocked: the tray simply does not remember. */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Tapping a compare control: returns whether the tray refused because it is full. */
export function toggleCompare(id: string): { full: boolean; on: boolean } {
  const before = snapshot();
  const next = toggled(before, id);
  if (!next.full) write(next.ids);
  return { full: next.full, on: next.ids.includes(id.toLowerCase()) };
}

export function removeCompare(id: string): void {
  write(snapshot().filter((x) => x !== id.toLowerCase()));
}

export function clearCompare(): void {
  write([]);
}

/** The tray's ids, live: moves with every other control and every other tab. */
export function useCompareTray(): { ids: string[]; has: (id: string) => boolean } {
  const ids = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const has = useCallback((id: string) => ids.includes(id.toLowerCase()), [ids]);
  return { ids, has };
}
