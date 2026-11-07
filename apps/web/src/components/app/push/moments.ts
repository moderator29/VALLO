/**
 * WHEN TO ASK FOR THE NOTIFICATION PERMISSION, AND WHEN NEVER TO.
 *
 * ===========================================================================
 * THE ONE FACT THAT MAKES THIS FILE NECESSARY.
 *
 * ASKING ON FIRST LAUNCH IS HOW AN APPLICATION GETS REFUSED PERMANENTLY. On
 * iOS a declined system prompt cannot be shown again, ever: the only way back
 * is the Settings app, and almost nobody goes. On the web a denied permission
 * cannot be re-prompted from the page at all. There is exactly one system
 * prompt per install and it is spent the first time it is shown.
 *
 * So the system prompt is never the first thing a person sees. A Vallo screen
 * comes first, in our own words, saying precisely what will be sent and
 * offering Not now. Only a Yes on that screen may call the system API. A No
 * on our screen costs nothing, because our screen can be shown again and the
 * system's cannot.
 *
 * This is also what the Android manifest has said all along in its own words:
 * do not spend the one prompt a person reliably grants on a channel that
 * cannot deliver anything. That comment was right, and it stays right; what
 * changes is that the channel can now deliver.
 *
 * ===========================================================================
 * ASK AT THE MOMENT THE VALUE IS OBVIOUS, WHICH IS ALWAYS A MOMENT OF
 * SUCCESS, NEVER A MOMENT OF FRICTION.
 *
 * Every moment below is immediately after a person has just done something
 * that worked, and every offer names the specific thing they will now not
 * miss. A person who has just published a listing wants to know when somebody
 * asks about it; a person who has just sent a booking request wants to know
 * when the host answers. That is a very different question from one asked on
 * a home screen, and it converts differently by a large multiple.
 *
 * NEVER on the home screen. NEVER on a payment screen: a permission dialogue
 * over a payment reads as a trick and costs the payment as well as the
 * permission. NEVER inside the sign-up FORM either; but the founder ruled on
 * 7 November 2026 that offering notifications is a DEFAULT STEP of joining,
 * the way Hauslet asks right after sign-in. So `joined` exists: the last beat
 * of first run (`FirstRun.tsx`), after the account exists and the interests
 * question is answered, with the person already inside Vallo's own screens.
 * The discipline stands unchanged: Vallo's screen first, the one system
 * prompt only after a Yes, and a No honoured for thirty days.
 *
 * ===========================================================================
 * EVERYTHING HERE IS PURE. It takes a moment and a small record of what has
 * been asked before and returns a verdict. No browser API is touched, so
 * every rule below is testable, which matters because the cost of getting the
 * re-ask rule wrong is not a bug report, it is a person who has silently
 * turned the application off.
 */

/** The moments at which asking is allowed at all. */
export type PushMoment =
  /** A lister has just published their first listing. */
  | "listing_published"
  /** A guest has just sent their first booking request. */
  | "booking_requested"
  /** A second reply in one conversation: this is now a conversation. */
  | "conversation_active"
  /** A person has opened the notification settings themselves, which is the
      one place asking is not an interruption, because they came to ask us. */
  | "settings_opened"
  /** The last step of first run: the account exists, the interests question
      is behind them, and joining is the moment (the founder, 7 Nov 2026). */
  | "joined";

/** What the person will actually get, in the words they are shown. */
export const MOMENT_OFFER: Readonly<Record<PushMoment, string>> = {
  listing_published: "Know the moment somebody asks about it.",
  booking_requested: "Know the moment the host answers.",
  conversation_active: "Know when they write back.",
  settings_opened: "Choose what reaches your phone.",
  joined: "Booking answers, messages and your money, as they happen.",
};

/**
 * What this device remembers about being asked.
 *
 * Per device, deliberately, and kept in `localStorage` rather than on the
 * profile. The permission itself is per device: a person who granted it on
 * their phone has not granted it on the tablet they just picked up, and
 * asking them on the tablet is correct. A server-side record would suppress
 * that second, legitimate ask.
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

/** How long to wait after a No before the subject may be raised again. */
export const RE_ASK_AFTER_DAYS = 30;

/** Two declines is an answer. A third offer is pestering. */
export const MAX_DECLINES = 2;

/** What the browser or the operating system currently says. */
export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export type OfferVerdict =
  | { show: false; because: "granted" | "denied" | "unsupported" | "too_soon" | "asked_enough" }
  | { show: true; offer: string };

/**
 * Should the Vallo screen be shown at this moment?
 *
 * The order matters and each refusal is a different fact:
 *
 *  - `granted`: there is nothing to ask for.
 *  - `denied`: THE SYSTEM PROMPT IS SPENT. Showing our screen now would lead
 *    somewhere that cannot work, and a Yes that produces nothing is worse
 *    than never having offered. What belongs here instead is a line on the
 *    settings screen telling the person where in their own settings to turn
 *    it back on, which is the only route left.
 *  - `unsupported`: an older Android browser, or iOS Safari on a site that
 *    has not been installed to the home screen, where web push does not
 *    exist at all.
 *  - `too_soon` and `asked_enough`: the re-ask rules below.
 */
export function offerVerdict(input: {
  moment: PushMoment;
  permission: PermissionState;
  memory: PromptMemory;
  now: number;
}): OfferVerdict {
  const { moment, permission, memory, now } = input;

  if (permission === "granted") return { show: false, because: "granted" };
  if (permission === "denied") return { show: false, because: "denied" };
  if (permission === "unsupported") return { show: false, because: "unsupported" };

  if (memory.declines >= MAX_DECLINES) return { show: false, because: "asked_enough" };

  if (memory.declinedAt !== null) {
    const elapsed = now - memory.declinedAt;
    if (elapsed < RE_ASK_AFTER_DAYS * 24 * 60 * 60 * 1000) {
      return { show: false, because: "too_soon" };
    }
  }

  return { show: true, offer: MOMENT_OFFER[moment] };
}

/**
 * Record a No on our own screen.
 *
 * Note what this does NOT do: it does not record a No to the SYSTEM prompt.
 * That one is held by the browser or the operating system, is readable as
 * `denied`, and is not ours to remember or to second-guess.
 */
export function rememberDecline(memory: PromptMemory, now: number): PromptMemory {
  return { ...memory, declinedAt: now, declines: memory.declines + 1 };
}

export function rememberSystemAsked(memory: PromptMemory): PromptMemory {
  return { ...memory, systemAsked: true };
}

/**
 * Is the Android explanation screen worth showing on this handset at all?
 *
 * `POST_NOTIFICATIONS` is a runtime permission only on Android 13, API 33,
 * and above. Below that the permission is granted at install and NO PROMPT
 * EXISTS, so showing an explanation screen there asks somebody to agree to
 * something that already happened. The screen is skipped and registration
 * proceeds directly.
 */
export function androidNeedsPrompt(apiLevel: number | null): boolean {
  if (apiLevel === null) return true;
  return apiLevel >= 33;
}

const MEMORY_KEY = "vallo.push.prompt";

/**
 * Read the memory, never throwing.
 *
 * `localStorage` throws outright in a private window on some browsers and in
 * a web view with site data blocked, and this runs on a path where a throw
 * would take a page down. A device that cannot remember is treated as a
 * device that has never been asked, which errs towards offering once too
 * often rather than towards never offering at all.
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
