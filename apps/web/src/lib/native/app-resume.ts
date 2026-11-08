import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { isTyping, shouldRefreshOnResume } from "./app-resume-rule";

/**
 * Clear the app badge and delivered notifications when the person opens the
 * app. Without this, a badge set by a push notification stays until the
 * person force-quits, and there is nothing they can tap to make it go away.
 */
function clearBadge(): void {
  try {
    const plugin = Capacitor.registerPlugin("PushNotifications");
    (plugin as { removeAllDeliveredNotifications?: () => Promise<void> })
      .removeAllDeliveredNotifications?.()
      .catch(() => {});
  } catch {
    /* Plugin not available on this binary. */
  }
}

/**
 * The app's own foreground listener (there was none outside a call:
 * AUDIT_2026-11.md section 6). On `appStateChange` back to active after a
 * real absence, `refresh` runs once (the router's refresh, from
 * `NativeRuntime`). Returns the teardown. The plugin handle is carried in a
 * local, never returned from this async function (the Capacitor `.then`
 * trap, `lib/native/device.ts`).
 */
export async function startAppResume(refresh: () => void): Promise<() => void> {
  clearBadge();
  let leftAt: number | null = null;
  const handle = await App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) {
      leftAt = Date.now();
      return;
    }
    clearBadge();
    const awayMs = leftAt === null ? 0 : Date.now() - leftAt;
    leftAt = null;
    if (
      shouldRefreshOnResume({
        awayMs,
        typing: isTyping(document.activeElement),
        online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
      })
    ) {
      refresh();
    }
  });
  return () => {
    void handle.remove();
  };
}
