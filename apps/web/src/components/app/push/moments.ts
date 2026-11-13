/**
 * WHETHER THE ONE NOTIFICATIONS SCREEN IS SHOWN ON THIS DEVICE.
 *
 * ===========================================================================
 * THERE IS ONE ASK, AND IT IS AT THE END OF JOINING (the founder, 13 November
 * 2026: "Unified once allowed from iPhone then it should turn notis for all
 * that one no other buttons everywhere ... we need organized").
 *
 * The asks that used to appear inside the product (after a listing was
 * published, after a booking request, in a conversation that had become one)
 * are gone. The screen is shown once, as the last beat of first run
 * (`FirstRun.tsx`), and after that the only place notifications are switched
 * on or off is the master switch on Settings > Notifications (`PushSetting`).
 *
 * The discipline that made this file stays: Vallo's own screen comes first,
 * and the operating system's prompt is reached only from its Turn on button,
 * because there is one system prompt per install and on iOS a refusal to it
 * is permanent.
 *
 * ===========================================================================
 * A NO IS FINAL. Not now on our screen, or a refusal of the system prompt,
 * and the screen is never shown again on this device. There is no thirty day
 * re-ask any more: a member who wants notifications later has the switch on
 * Settings, which is always there and never asks unbidden.
 *
 * EVERYTHING HERE IS PURE apart from the two storage helpers at the foot, so
 * every rule is tested in the node suite.
 */

/**
 * What this device remembers about being asked.
 *
 * Per device, deliberately, and kept in `localStorage` rather than on the
 * profile: the permission itself is per device. The stored shape is the one
 * earlier builds wrote, so a device that declined under the old rules is read
 * as having declined.
 */
export type PromptMemory = {
  /** When our own screen was last declined, as epoch milliseconds. */
  declinedAt: number | null;
  /** How many times our own screen has been declined. */
  declines: number;
  /** True once the system prompt has been reached, whatever it answered. */
  systemAsked: boolean;
};

export const NO_MEMORY: PromptMemory = { declinedAt: null, declines: 0, systemAsked: false };

/** What the browser or the operating system currently says. */
export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export type OfferVerdict =
  | { show: false; because: "registered" | "denied" | "unsupported" | "answered" }
  | { show: true };

/**
 * Should the one screen be shown on this device?
 *
 *  - `denied`: the system prompt is spent; only the phone's own Settings can
 *    undo it, and the Settings screen says so.
 *  - `unsupported`: no push here at all (iOS Safari outside the home screen
 *    app, an old browser).
 *  - `answered`: this device has already said Not now, or already reached the
 *    system prompt. A No is final; the Settings switch is the way back.
 *  - `registered`: the permission is granted AND this device is registered,
 *    so there is nothing to turn on.
 *
 * A permission that is granted on a device that is NOT registered (Android
 * 12 and below grant it at install; a browser that allowed Vallo before) is
 * shown the screen: its Turn on registers the device and switches every kind
 * on, which an already granted permission would otherwise never do.
 */
export function offerVerdict(input: {
  permission: PermissionState;
  /** Whether this device holds a registration (`readLocalDevice`). */
  registered: boolean;
  memory: PromptMemory;
}): OfferVerdict {
  const { permission, registered, memory } = input;

  if (permission === "denied") return { show: false, because: "denied" };
  if (permission === "unsupported") return { show: false, because: "unsupported" };
  if (memory.declines > 0 || memory.declinedAt !== null || memory.systemAsked) {
    return { show: false, because: "answered" };
  }
  if (permission === "granted" && registered) return { show: false, because: "registered" };
  return { show: true };
}

/** Record a Not now on our own screen. */
export function rememberDecline(memory: PromptMemory, now: number): PromptMemory {
  return { ...memory, declinedAt: now, declines: memory.declines + 1 };
}

/** Record that the system prompt was reached, whatever it answered. */
export function rememberSystemAsked(memory: PromptMemory): PromptMemory {
  return { ...memory, systemAsked: true };
}

const MEMORY_KEY = "vallo.push.prompt";

/**
 * Read the memory, never throwing.
 *
 * `localStorage` throws outright in a private window on some browsers and in
 * a web view with site data blocked. A device that cannot remember is treated
 * as one that has never been asked; the screen is only ever reached from
 * first run, so that costs at most one more offer.
 */
export function readMemory(): PromptMemory {
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return NO_MEMORY;
    const parsed = JSON.parse(raw) as Partial<PromptMemory>;
    return {
      declinedAt: typeof parsed.declinedAt === "number" ? parsed.declinedAt : null,
      declines: typeof parsed.declines === "number" ? parsed.declines : 0,
      systemAsked: parsed.systemAsked === true,
    };
  } catch {
    return NO_MEMORY;
  }
}

export function writeMemory(memory: PromptMemory): void {
  try {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    /* Nothing to do. See `readMemory`. */
  }
}
