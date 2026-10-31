/**
 * TRUE CONNECTIVITY (fast-start plan item 16, 31 October 2026).
 *
 * `navigator.onLine` only says whether the phone has a network INTERFACE: it
 * stays true behind a captive portal, on Wi-Fi with no internet, and in a
 * tunnel with a dead radio. On the native shell `@capacitor/network` asks the
 * operating system whether the connection can actually carry traffic, and
 * `lib/native/network.ts` feeds its answer in here. On the website nothing
 * feeds it and this answers exactly as `navigator.onLine` always did.
 *
 * One rule, so every caller agrees: OFFLINE means the browser is sure
 * (`navigator.onLine === false`) OR the native layer is sure
 * (`setNativeConnected(false)`). Unknown is online, so a missing plugin or a
 * failed read can only ever leave things as they were. No imports: this is
 * read from the outbox, the uploader and the connection line.
 */

let nativeConnected: boolean | null = null;
const listeners = new Set<() => void>();

/** Whether the app should behave as offline right now. */
export function isOffline(): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return nativeConnected === false;
}

/** The native layer's verdict: true, false, or null for "no verdict". */
export function setNativeConnected(connected: boolean | null): void {
  if (nativeConnected === connected) return;
  nativeConnected = connected;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      /* One broken listener must not silence the others. */
    }
  }
  /* The same events the browser fires, so every existing `online` and
     `offline` listener (the outbox drain, the connection line, the error
     boundaries) reacts without being rewritten. */
  try {
    if (typeof window !== "undefined" && connected !== null) {
      window.dispatchEvent(new Event(connected ? "online" : "offline"));
    }
  } catch {
    /* No window. */
  }
}

/** Subscribe to changes of the native verdict only (the browser has its own events). */
export function onNativeConnectivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
