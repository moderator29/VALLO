"use client";

import { useSyncExternalStore } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * Whether the browser believes it has a connection.
 *
 * `navigator.onLine` is optimistic (true on a captive portal), so it is used
 * only to say "you are offline" when it is sure, never to promise a send will
 * work. The server render has no navigator and reads as online, so nothing
 * flashes a warning on first paint.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * The offline line a support screen shows above its one action.
 *
 * It says what still works: the draft stays on this device, so nothing typed
 * is lost, and it goes when the connection is back.
 */
export function OfflineNote({ forceOffline = false, what = "Your message" }: { forceOffline?: boolean; what?: string }) {
  const online = useOnline();
  if (online && !forceOffline) return null;
  return (
    <p
      role="status"
      data-testid="support-offline"
      className="nf-caption flex items-start gap-inline rounded-control border border-[var(--nf-border-subtle)] bg-[var(--nf-state-warning-surface)] px-sm py-xs text-[var(--nf-content-primary)]"
    >
      <UiIcon name="info" size={16} className="mt-3xs shrink-0 text-[var(--nf-state-warning)]" />
      <span className="min-w-0">
        You are offline. {what} is kept on this device and can be sent when you are back online.
      </span>
    </p>
  );
}
