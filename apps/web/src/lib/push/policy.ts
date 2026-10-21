import { fitPush, lockScreenSafe } from "./copy";
import { isUrgentKind, wantsPush, type NotificationKind } from "./preferences";
import { sameOriginPath } from "./same-origin";
import { quietVerdict, readQuietHours } from "./quiet-hours";
import type { PushPayload } from "./types";
import { actionsFor, recipientLocale } from "./actions";
import { DEFAULT_LOCALE, localizePush, pushSummary, type Locale } from "@vallo/i18n";
import { severityOf } from "@/lib/notify/severity";

/**
 * EVERY DECISION ABOUT ONE QUEUED PUSH, AS A PURE FUNCTION.
 *
 * ---------------------------------------------------------------------------
 * WHY THE POLICY IS HERE AND NOT IN THE DRAIN, AND NOT IN SQL.
 *
 * The drain does input and output: it claims rows, posts to providers, writes
 * what came back. If the rules about who gets what and when were tangled into
 * it, every one of them could only be tested by standing up a database and a
 * push service. Here they are functions from plain values to a verdict, so
 * the awkward cases that actually bite (a window that wraps midnight, a
 * settings document written by a three-version-old client, eleven things
 * arriving during the night) are pinned by tests that run in milliseconds.
 *
 * It is also not in a migration, for a reason worth stating: policy in a
 * migration can only be changed by another migration, and this policy will be
 * argued about. The queue's trigger therefore decides exactly one thing, and
 * it is the one thing SQL should decide: whether there is any device to send
 * to at all.
 */

/** What the drain should do with one queued row. */
export type Decision =
  /** Send it now, with this payload. */
  | { action: "send"; payload: PushPayload }
  /** Not now. Put `not_before` here and leave it queued. */
  | { action: "hold"; until: Date }
  /** Settle it without sending, for this recorded reason. */
  | {
      action: "suppress";
      outcome: "suppressed_preference" | "suppressed_expired";
    };

export type QueuedNotification = {
  queueId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: Date;
  expiresAt: Date;
};

/**
 * The tag a notification collapses under, on the device and at the push
 * service.
 *
 * Per person, per kind. Two messages in the same conversation replace each
 * other on the lock screen instead of stacking, which is the difference
 * between a phone that is useful and one somebody turns notifications off on.
 * Deliberately NOT per notification id, because a unique tag collapses
 * nothing and that is the default everybody ships by accident.
 */
export function collapseTag(kind: NotificationKind): string {
  return `vallo-${kind}`;
}

/**
 * Where a push lands when it is tapped.
 *
 * `href` on the notification row is trusted only so far: it is written by
 * eleven triggers and two server call sites, and an absolute URL from any of
 * them would be an open redirect through a lock screen. Only a path on our
 * own origin is ever carried, and anything else falls back to the
 * notifications list, which is always a truthful destination.
 */
export function safeHref(href: string | null): string {
  /* `same-origin.ts` also refuses "/\\host" and "/\t/host", which a
     browser resolves off the origin just like "//host". */
  return sameOriginPath(href) ?? "/notifications";
}

/**
 * THE ONE NON-WALLET PUSH THAT IGNORES QUIET HOURS: A NEW SIGN-IN. V-19.
 *
 * `preferences.ts` explains why urgency is decided by kind and why that is a
 * limitation: `notifications` carries no severity. A new device signing in to
 * an account that holds a wallet is the event where eight hours of quiet is
 * eight hours for a stranger, so it has to wake the phone. It is written by
 * one trigger (`private.notify_new_device`) as a `system` row, and rather
 * than promote every `system` notice to urgent, the rule keys on the path
 * that trigger alone writes. That is a path on our own origin chosen by our
 * own SQL, not a parser over a person's words, which is the line
 * `preferences.ts` draws.
 */
export const URGENT_PATH_PREFIXES: readonly string[] = ["/settings/devices/alert"];

export function isUrgentPath(href: string | null): boolean {
  if (typeof href !== "string") return false;
  const path = safeHref(href);
  return (
    isIncomingCallPath(path) ||
    URGENT_PATH_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`),
    )
  );
}

/**
 * AN INCOMING CALL RINGS THROUGH QUIET HOURS (the founder, 8 October 2026).
 * Only the ring itself: `private.call_ring` alone writes a call link carrying
 * `?call=<id>` (a thread, the agent side of one, or a review invitation), and
 * that push already expires with the 45 second ring, so it can never wake
 * somebody about a call that has stopped. The missed-call notice links
 * without `?call=` and still waits for the morning.
 */
const INCOMING_CALL_PATH = /^\/(?:agent\/messages|messages|calls\/reviews)\/[0-9a-f-]{36}\?call=[0-9a-f-]{36}$/;

export function isIncomingCallPath(path: string): boolean {
  return INCOMING_CALL_PATH.test(path);
}

/**
 * Decide the fate of one queued push.
 *
 * The order of the tests is the policy, and it is deliberate:
 *
 * 1. EXPIRY FIRST, before anything else. A push about something that
 *    happened yesterday is not improved by being correct about preferences.
 *    This is also what stops a queue that was stuck for a week from firing a
 *    week of backlog at somebody's lock screen the moment it recovers.
 * 2. PREFERENCE NEXT. Somebody who turned this off should not have the
 *    system reasoning about their sleep afterwards.
 * 3. QUIET HOURS LAST, because it is the only test that can say "later"
 *    rather than "no", and asking it before the others would hold things
 *    that were never going to be sent.
 */
export function decide(input: {
  notification: QueuedNotification;
  /** `profiles.settings`, as jsonb, in whatever shape it is in. */
  settings: unknown;
  now: Date;
}): Decision {
  const { notification, settings, now } = input;

  if (notification.expiresAt.getTime() <= now.getTime()) {
    return { action: "suppress", outcome: "suppressed_expired" };
  }

  if (!wantsPush(settings, notification.kind)) {
    return { action: "suppress", outcome: "suppressed_preference" };
  }

  /* B13: a price drop on a saved place pushes unless the member turned that
     one off (settings, "Price drops on places you saved", default on). */
  if (isSavedPriceDrop(notification.href) && !wantsSavedPriceDrops(settings)) {
    return { action: "suppress", outcome: "suppressed_preference" };
  }

  const urgent = isUrgentKind(notification.kind) || isUrgentPath(notification.href);
  const quiet = quietVerdict({ quiet: readQuietHours(settings), at: now, urgent });
  if (quiet.held) {
    /* A hold that would outlive the row is not a hold, it is a slow
       suppression. Settling it now is more honest than waking up at seven to
       discard it. */
    if (quiet.until.getTime() >= notification.expiresAt.getTime()) {
      return { action: "suppress", outcome: "suppressed_expired" };
    }
    return { action: "hold", until: quiet.until };
  }

  const locale = recipientLocale(settings);
  /* A11: the database wrote this in English; the lock screen shows it in the
     recipient's language where the catalogue has it (machine drafts for ha,
     yo and ig, awaiting native review), and in English otherwise. */
  const text = localizePush({ title: notification.title, body: notification.body }, locale);
  return {
    action: "send",
    payload: {
      /* Held to the lock-screen limits (lib/push/copy.ts): a title longer
         than a phone shows arrives cut at a word, not mid-letter. */
      /* And no account or phone number in full (`maskLongDigitRuns`). */
      ...fitPush(lockScreenSafe(text)),
      href: safeHref(notification.href),
      tag: collapseTag(notification.kind),
      urgent,
      /* B11: an fyi never wakes the phone: it arrives silent. */
      quiet: !urgent && severityOf(notification).severity === "fyi",
      actions: actionsFor(notification.kind, notification.href, locale),
    },
  };
}

/**
 * Above this many sendable pushes for one person in one drain, they get one
 * summary instead.
 *
 * Three is a judgement and it is the judgement the research asked for:
 * "one notification saying how many things happened, not eleven at seven in
 * the morning". Two or three separate notifications are still informative;
 * eleven is a wall of noise that gets the application silenced.
 */
export const COLLAPSE_THRESHOLD = 3;

export type CollapsePlan = {
  /** The rows to actually send, with the payload each should carry. */
  send: Array<{ queueId: string; payload: PushPayload }>;
  /**
   * Rows folded into another. The value is the queue id of the row whose
   * summary carried them, which is what `push_queue.collapsed_into` records
   * so the folding can be audited afterwards.
   */
  collapsed: Array<{ queueId: string; into: string }>;
};

/**
 * Fold a person's backlog into one notification.
 *
 * THIS IS WHAT MAKES QUIET HOURS WORTH HAVING. Holding eleven notifications
 * until seven in the morning and then delivering eleven notifications at
 * seven in the morning is not a kindness, it is the same interruption moved.
 *
 * Two rules keep it from doing harm:
 *
 *  - URGENT ROWS ARE NEVER FOLDED. A reversed transaction does not become
 *    "3 updates". They are sent individually whatever else is waiting.
 *  - THE SUMMARY INHERITS THE NEWEST ROW, not the oldest, so tapping it
 *    lands on the most recent thing rather than on something from midnight.
 *    The row that carries the summary is the newest, so `collapsed_into`
 *    points forwards in time, which is what somebody reading the audit
 *    would expect.
 */
export function planCollapse(
  candidates: Array<{ queueId: string; payload: PushPayload; createdAt: Date }>,
  /** A11: the person's language, for the summary line. */
  locale: Locale = DEFAULT_LOCALE,
): CollapsePlan {
  const urgent = candidates.filter((candidate) => candidate.payload.urgent);
  const ordinary = candidates.filter((candidate) => !candidate.payload.urgent);

  const send: CollapsePlan["send"] = urgent.map((candidate) => ({
    queueId: candidate.queueId,
    payload: candidate.payload,
  }));
  const collapsed: CollapsePlan["collapsed"] = [];

  if (ordinary.length <= COLLAPSE_THRESHOLD) {
    for (const candidate of ordinary) {
      send.push({ queueId: candidate.queueId, payload: candidate.payload });
    }
    return { send, collapsed };
  }

  const newestFirst = [...ordinary].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const carrier = newestFirst[0];
  /* Unreachable: the branch above returned for anything at or below the
     threshold, and the threshold is positive. Narrowed rather than asserted,
     because an assertion here would be a crash inside the drain. */
  if (!carrier) return { send, collapsed };
  const rest = newestFirst.slice(1);

  send.push({
    queueId: carrier.queueId,
    payload: {
      title: "Vallo",
      body: pushSummary(ordinary.length, locale),
      /* The list, not the newest item: a summary that opens one of the
         eleven things it is summarising hides the other ten. */
      href: "/notifications",
      tag: "vallo-summary",
      urgent: false,
    },
  });
  for (const candidate of rest) {
    collapsed.push({ queueId: candidate.queueId, into: carrier.queueId });
  }

  return { send, collapsed };
}

/** B13: the saved-place price-drop notification (the pending trigger's href). */
export function isSavedPriceDrop(href: string | null): boolean {
  return typeof href === "string" && /^\/listing\/[^?#]+\?(?:.*&)?change=price-down(?:&|$)/.test(href);
}

/** B13: the member's "price drops on places you saved" push switch; on unless turned off. */
export function wantsSavedPriceDrops(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return true;
  const notifications = (settings as Record<string, unknown>).notifications;
  if (!notifications || typeof notifications !== "object") return true;
  const value = (notifications as Record<string, unknown>).savedPriceDrops;
  return value !== false;
}
