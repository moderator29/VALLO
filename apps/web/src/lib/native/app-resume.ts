import { App } from "@capacitor/app";
import { isTyping, shouldRefreshOnResume } from "./app-resume-rule";

/**
 * The app's own foreground listener (there was none outside a call:
 * AUDIT_2026-11.md section 6). On `appStateChange` back to active after a
 * real absence, `refresh` runs once (the router's refresh, from
 * `NativeRuntime`). Returns the teardown. The plugin handle is carried in a
 * local, never returned from this async function (the Capacitor `.then`
 * trap, `lib/native/device.ts`).
 */
export async function startAppResume(refresh: () => void): Promise<() => void> {
  let leftAt: number | null = null;
  const handle = await App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) {
      leftAt = Date.now();
      return;
    }
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
