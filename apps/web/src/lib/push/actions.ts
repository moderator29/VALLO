import { getDictionary, DEFAULT_LOCALE, isLocale, type Locale } from "@vallo/i18n";
import type { NotificationKind } from "./preferences";

/**
 * NOTIFICATIONS YOU CAN ACT ON. V-53.
 *
 * A push that can only be tapped is a push that asks the person to work out
 * what to do next. For the moments where the next step is obvious, the
 * notification carries up to two buttons that go straight to it.
 *
 * ---------------------------------------------------------------------------
 * EVERY BUTTON OPENS VALLO. NONE ACTS FROM THE LOCK SCREEN.
 *
 * The entry asked for "Accept" to accept an inspection from the lock screen,
 * through a signed single-use token in the payload. That is not built, on
 * purpose: a button that commits somebody to a time, from a lock screen, on a
 * phone that may be in somebody else's hand, is a mutation made without a
 * session, and it would need a token table, a secret and its own abuse review.
 * So each button is a DESTINATION: it opens the screen where the action is
 * one tap away, signed in, with the person looking at what they are agreeing
 * to. The labels say where they go ("Open inspections", "Reply"), not
 * what they would do, so no button claims to have done something it has not.
 *
 * ---------------------------------------------------------------------------
 * THE MOMENTS, and why only these.
 *
 *   message          "Reply" -> the thread.
 *   listing or agent, to /agent/inspections   "Open inspections" -> the
 *                    lister's inspections, where Accept and Suggest another
 *                    time live (the trigger writes these as kind `listing`).
 *   booking, to /bookings or /trips   "Open the booking" -> the booking,
 *                    where its details and the in-app map live (the
 *                    button never opens an outside maps app).
 *
 * Everything else carries no buttons: a tap on the notification is already
 * the right answer, and a button that repeats the tap is noise.
 *
 * Every href is re-checked by the same rule as the tap (`safeHref`), and the
 * service worker checks it again. Web Push shows at most two actions on
 * Chrome for Android; the list is capped at two here so the device never
 * silently drops one.
 */

export type PushAction = {
  /** A stable id the service worker and the shell route on. */
  id: "reply" | "answer" | "open-booking" | "message" | "call-back";
  title: string;
  /** A path on our own origin. */
  href: string;
};

import { sameOriginPath } from "./same-origin";

const MAX_ACTIONS = 2;

function onOrigin(href: string | null): string | null {
  return sameOriginPath(href);
}

/** The recipient's language from `profiles.settings`, or the default. */
export function recipientLocale(settings: unknown): Locale {
  const value = settings && typeof settings === "object" ? (settings as { locale?: unknown }).locale : null;
  return typeof value === "string" && isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The buttons, titled in the RECIPIENT's language. Only the web push
 * service worker draws them: FCM and APNs deliveries carry them in the data
 * payload for the native tap handler, but no native button is drawn until
 * the Android and iOS projects register notification categories.
 */
export function actionsFor(kind: NotificationKind, href: string | null, locale: Locale = DEFAULT_LOCALE): PushAction[] {
  const path = onOrigin(href);
  if (!path) return [];
  const copy = getDictionary(locale).platform.pushActions;
  const out: PushAction[] = [];

  if (kind === "message" && path.startsWith("/messages/")) {
    out.push({ id: "reply", title: copy.reply, href: path });
  } else if ((kind === "agent" || kind === "listing") && path.startsWith("/agent/inspections")) {
    out.push({ id: "answer", title: copy.answer, href: path });
  } else if (kind === "booking" && /^\/(bookings|trips)(\/|\?|$)/.test(path)) {
    out.push({ id: "open-booking", title: copy.openBooking, href: path });
  }

  return out.slice(0, MAX_ACTIONS);
}

/** Actions as a string, for transports whose data values must be strings (FCM). */
export function actionsAsData(actions: readonly PushAction[] | undefined): string {
  return JSON.stringify((actions ?? []).slice(0, MAX_ACTIONS));
}
