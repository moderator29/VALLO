/**
 * WHETHER THIS DEVICE IS ON, AND WHAT TO SAY WHEN IT IS NOT.
 *
 * ===========================================================================
 * THE BLIND LIGHT, 23 SEPTEMBER.
 *
 * The founder allowed notifications inside the iPhone home screen app, signed
 * in, and the settings control read as on. `push_tokens` had never held a row.
 * The control had decided it was on from `Notification.permission`, which is a
 * fact about the BROWSER. It says nothing about whether Vallo can reach the
 * device. Nor does a local `PushSubscription`: a browser will happily hold one
 * that the server never recorded.
 *
 * So there is exactly one way for the control to read ON, and it needs the
 * server's word for THIS device, not for the account:
 *
 *   1. `/api/push/register` answered ok for this device and gave back its
 *      `device_ref`, which is recorded here in `localStorage`; and
 *   2. the settings page, server rendered from `push_tokens` where
 *      `revoked_at is null`, lists that same `device_ref` as live; and
 *   3. on the web, the browser still holds the subscription whose endpoint was
 *      registered (a browser that rotated or dropped it is a device we can no
 *      longer reach, whatever the row says); and
 *   4. the permission is still granted.
 *
 * A second device registered on the same account does not light this one.
 * The account-wide count the page used to pass is not enough on its own, and
 * it is only kept as a prop so the older call site still compiles.
 *
 * Pure functions, no React and no DOM, so the rules are tested in the node
 * suite rather than trusted.
 */

export type EnrolFailureReason =
  /* The person, or a previous permanent refusal, said no. */
  | "permission_denied"
  /* No push in this browser at all. */
  | "unsupported"
  /* The deployment has no VAPID key (or no database), so there is nothing to
     subscribe against. Ours to fix; nothing the person can do. */
  | "not_configured"
  /* No session reached us on this request. Theirs to fix, in five seconds:
     sign in. On an iPhone the home screen app keeps a cookie store separate
     from Safari, so a person signed in in Safari is signed out in the app. */
  | "signed_out"
  /* The subscription or token was obtained and the server would not record
     it. */
  | "not_saved"
  | "failed";

/** What this device remembers about its own registration. Never the keys. */
export type LocalDevice = {
  deviceRef: string;
  /* The Web Push endpoint that was registered, or null on native, where the
     token is not observable again without re-registering. */
  endpoint: string | null;
};

export const LOCAL_DEVICE_KEY = "vallo.push.device.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readLocalDevice(store: StorageLike | null = storage()): LocalDevice | null {
  if (!store) return null;
  try {
    const raw = store.getItem(LOCAL_DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDevice>;
    if (typeof parsed.deviceRef !== "string" || parsed.deviceRef.length === 0) return null;
    return {
      deviceRef: parsed.deviceRef,
      endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint : null,
    };
  } catch {
    return null;
  }
}

export function writeLocalDevice(device: LocalDevice, store: StorageLike | null = storage()): void {
  if (!store) return;
  try {
    store.setItem(LOCAL_DEVICE_KEY, JSON.stringify(device));
  } catch {
    /* Private mode or full storage. The next load then reads OFF, which is
       the safe direction to be wrong in. */
  }
}

export function clearLocalDevice(store: StorageLike | null = storage()): void {
  if (!store) return;
  try {
    store.removeItem(LOCAL_DEVICE_KEY);
  } catch {
    /* As above. */
  }
}

/**
 * THE ONLY WAY THE CONTROL READS ON.
 *
 * `liveRefs` is `undefined` when the page did not say (a harness, or a read
 * that failed). That is NOT an empty list and it is not a yes either: with no
 * word from the server the answer is no.
 */
export function deviceIsLive(input: {
  permission: "granted" | "denied" | "default" | "unsupported";
  local: LocalDevice | null;
  /* The endpoint of the subscription the browser holds now. `undefined` means
     not a web device (native), `null` means the browser holds none. */
  currentEndpoint: string | null | undefined;
  liveRefs: readonly string[] | undefined;
}): boolean {
  if (input.permission !== "granted") return false;
  if (!input.local) return false;
  if (!input.liveRefs || !input.liveRefs.includes(input.local.deviceRef)) return false;
  if (input.currentEndpoint !== undefined) {
    if (input.currentEndpoint === null) return false;
    if (input.local.endpoint !== input.currentEndpoint) return false;
  }
  return true;
}

/**
 * WHAT THE SETTINGS CONTROL DRAWS, from everything it knows. The component
 * calls this and nothing else decides it, so the tests below pin the screen.
 *
 * `confirmed` is a registration that succeeded on this visit: the server
 * answered ok and named `ref`. It reads on by itself only until the page's
 * list has been refreshed from the database (`listRefreshed`); after that the
 * list decides, and a list without the ref is off. The component tells a
 * refreshed list by the identity of the array it is handed, because a
 * refresh that returns the same contents (an empty list both times) must
 * still end the grace.
 *
 * `verified` is the `deviceIsLive` answer computed against the refs keyed
 * `key`; a stale one does not count.
 */
export function controlState(input: {
  allowed: boolean;
  refsKey: string;
  registeredRefs: readonly string[] | undefined;
  confirmed: { ref: string; listRefreshed: boolean } | null;
  verified: { key: string; live: boolean } | null;
}): "on" | "checking" | "off" {
  if (!input.allowed) return "off";
  const { confirmed, verified } = input;
  if (confirmed) {
    if (!confirmed.listRefreshed) return "on";
    if (input.registeredRefs?.includes(confirmed.ref)) return "on";
    if (verified && verified.key === input.refsKey && verified.live) return "on";
    return "off";
  }
  if (verified && verified.key === input.refsKey) return verified.live ? "on" : "off";
  return "checking";
}

/** The key `controlState` compares, from the page's list of live refs. */
export function refsKeyOf(refs: readonly string[] | undefined): string {
  return refs ? refs.join(",") : "(unknown)";
}

/**
 * Is this the iPhone or iPad home screen app, where the sign-in is its own?
 * Read from the arguments so it can be tested without a browser.
 */
export function isIosHomeScreenApp(input: {
  userAgent: string;
  navigatorStandalone?: boolean;
  displayModeStandalone?: boolean;
}): boolean {
  const ios =
    /iPhone|iPad|iPod/i.test(input.userAgent) ||
    /* iPadOS reports itself as a Mac. Only a touch Mac is an iPad, but the
       standalone flag below is the stronger half of this test anyway. */
    (/Macintosh/i.test(input.userAgent) && input.navigatorStandalone === true);
  return ios && (input.navigatorStandalone === true || input.displayModeStandalone === true);
}

/**
 * One plain sentence for every failure. There is no failure that is allowed
 * to say nothing: that is how the control came to show a light and no words.
 *
 * `where` changes only the last clause: the prompt can send somebody to
 * Settings, the settings screen is Settings.
 */
export function failureMessage(
  reason: EnrolFailureReason,
  context: { iosHomeScreenApp: boolean; where: "settings" | "prompt"; reference?: string | null },
): string {
  /* An app build signed without Apple's push permission can never register:
     trying again changes nothing, so say that instead of "try again". */
  if (context.reference?.includes("aps-environment")) {
    return "This version of the Vallo app cannot receive notifications yet. A newer version will turn them on. Nothing for you to do.";
  }
  switch (reason) {
    case "signed_out":
      return context.iosHomeScreenApp
        ? "You're not signed in inside this app. Sign in here, then turn notifications on. The app on your home screen signs in separately from Safari."
        : "You're not signed in on this device any more, so it was not registered. Sign in, then turn notifications on.";
    case "not_configured":
      return "Notifications are not switched on for this version of Vallo yet. Nothing for you to do.";
    case "unsupported":
      return "This browser cannot show notifications. On an iPhone, add Vallo to your home screen and open it from there.";
    case "permission_denied":
      return "Notifications are blocked for Vallo on this device, so it was not registered. Allow them in your browser or phone settings, then try again.";
    case "not_saved":
      return context.where === "prompt"
        ? "We could not register this device. Nothing will reach it yet. You can try again from Settings."
        : "We could not register this device. Nothing will reach it yet. Try again in a moment.";
    case "failed":
    default:
      return context.where === "prompt"
        ? "That did not work, and this device was not registered. You can try again from Settings."
        : "That did not work, and this device was not registered. Try again in a moment.";
  }
}
