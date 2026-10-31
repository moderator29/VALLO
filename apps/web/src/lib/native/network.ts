import { setNativeConnected } from "../offline/connectivity";

/**
 * THE NATIVE CONNECTION CHECK (fast-start plan item 16). Started once by
 * `boot.ts` on the shell only. `@capacitor/network` reports whether the
 * operating system believes the connection works, which is what
 * `navigator.onLine` cannot tell behind a captive portal. The verdict goes to
 * `lib/offline/connectivity.ts`; every `online` and `offline` listener in the
 * app then reacts to it as it does to the browser's own events.
 *
 * NEEDS A NATIVE BUILD: the plugin is in `package.json`, and `npx cap sync`
 * adds it to both projects. On a shell built before that, the import answers
 * "not implemented" and this does nothing, so the app stays as it was.
 *
 * Returns the teardown; never throws.
 */
export async function startNetworkStatus(): Promise<() => void> {
  try {
    const { Network } = await import("@capacitor/network");
    const apply = (connected: boolean) => setNativeConnected(connected);
    const first = await Network.getStatus();
    apply(first.connected);
    const handle = await Network.addListener("networkStatusChange", (status) => apply(status.connected));
    return () => {
      void handle.remove();
      setNativeConnected(null);
    };
  } catch {
    /* No plugin in this build: the browser's own signal stays in charge. */
    return () => undefined;
  }
}
