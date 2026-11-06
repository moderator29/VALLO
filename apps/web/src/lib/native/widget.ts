import { looksNative } from "./platform";

/**
 * HANDING THE WIDGET ITS TOKEN. V-98, the JavaScript half.
 *
 * In the native app only, the app mints a device-bound token
 * (`mintWidgetToken`) and hands it, with this deployment's origin, to the
 * native `ValloWidget` plugin, which keeps it in the keystore or the keychain
 * App Group for the Android Glance and iOS WidgetKit widgets. Those native
 * widgets are not built yet; until they are, the plugin is absent and nothing
 * is minted, so no token exists that nothing holds.
 *
 * The marker records WHOSE token the widget holds. A different person signed
 * in on this phone gets a fresh token; signing out or deleting the account
 * drops the marker and tells the plugin to forget its token (`forgetWidget`).
 */

type WidgetPlugin = {
  setToken(options: { token: string; origin: string }): Promise<void>;
  clearToken?(): Promise<void>;
};

const HANDED = "vallo.widget.handed";

function readMarker(): string | null {
  try {
    return window.localStorage.getItem(HANDED);
  } catch {
    return null;
  }
}

/* Carried in an object: a Capacitor plugin throws when a promise reads `.then` on it. */
async function plugin(): Promise<{ readonly plugin: WidgetPlugin } | null> {
  if (typeof window === "undefined" || !looksNative()) return null;
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ValloWidget")) return null;
  return { plugin: Capacitor.registerPlugin<WidgetPlugin>("ValloWidget") };
}

/* The marker is "<user id>:<token id>": whose token, and which one. */
export async function handWidgetToken(
  userId: string,
  mint: () => Promise<{ token: string; id: string } | { error: string }>,
  live: (tokenId: string) => Promise<boolean | null>,
): Promise<"handed" | "skipped"> {
  if (typeof window === "undefined" || !looksNative() || !userId) return "skipped";
  const [markedUser, markedToken] = (readMarker() ?? "").split(":");
  if (markedUser === userId && markedToken) {
    /* The widget's token was revoked (a 401 for the widget): mint afresh. */
    if ((await live(markedToken).catch(() => null)) !== false) return "skipped";
  }
  const heldWidget = await plugin().catch(() => null);
  if (!heldWidget) return "skipped";
  const widget = heldWidget.plugin;
  const minted = await mint().catch(() => ({ error: "failed" }));
  if (!("token" in minted)) return "skipped";
  try {
    await widget.setToken({ token: minted.token, origin: window.location.origin });
    window.localStorage.setItem(HANDED, `${userId}:${minted.id}`);
    return "handed";
  } catch {
    return "skipped";
  }
}

/** Sign-out and deletion: the widget forgets its token and the marker goes. */
export async function forgetWidget(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HANDED);
  } catch {
    /* Nothing stored, nothing to drop. */
  }
  const heldWidget = await plugin().catch(() => null);
  await heldWidget?.plugin.clearToken?.().catch(() => undefined);
}
