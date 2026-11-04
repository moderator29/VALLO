import type { Database } from "@/lib/supabase/database.types";

/**
 * WHETHER THIS PERSON WANTS THIS PUSH, READ OUT OF A DOCUMENT SEVERAL
 * VERSIONS OF THE APPLICATION HAVE WRITTEN TO.
 *
 * ---------------------------------------------------------------------------
 * THE SHAPE, AND WHY IT EXTENDS RATHER THAN REPLACES.
 *
 * `/settings/notifications` has written four booleans into
 * `profiles.settings.notifications` since the settings page shipped:
 * `bookings`, `messages`, `wallet`, `marketing`. Those are read today by
 * `lib/email/recipients.ts` for email and by `private.notify` for the in-app
 * row. One boolean governed two channels, which was honest when there were
 * two channels.
 *
 * With push there are three, and one boolean per topic can no longer say what
 * people mean: plenty of people want a message in app and on their phone but
 * not in their inbox. So a `channels` object is added BESIDE the four
 * booleans, never in place of them, and the reading rules below are what keep
 * every document ever written by this product readable.
 *
 * ---------------------------------------------------------------------------
 * THE READING RULES, IN PRECEDENCE ORDER. THESE ARE THE WHOLE FILE.
 *
 * 1. An explicit `channels.<topic>.push` boolean wins.
 * 2. Failing that, the old boolean for that topic wins, because somebody who
 *    switched Bookings off before this existed meant it, and they meant it
 *    about every channel they had.
 * 3. Failing that, DELIVER. A missing key, a malformed value, a topic nobody
 *    has a switch for: all of them mean the person never chose. This is the
 *    same failure direction `private.notify` states in the database and it is
 *    the right one, because the cost of a notification somebody did not want
 *    is annoyance and the cost of silence is a missed booking.
 *
 * The one exception to rule 3 is `marketing`, which is OFF unless somebody
 * explicitly turned it on. Consent to be marketed at is not something a
 * person gives by not having an opinion.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE READS AN ADDRESS, A TOKEN OR A NAME. It takes a jsonb document
 * and a notification kind and returns a boolean. That is the whole contract,
 * and it is what lets every branch be tested without a database.
 */

export type NotificationKind = Database["public"]["Enums"]["notification_kind"];

/** The topics the preference grid is organised by. */
export type PushTopic =
  | "bookings"
  | "messages"
  | "wallet"
  | "listings"
  | "social"
  | "moderation"
  | "marketing";

/**
 * Which topic a notification kind belongs to.
 *
 * `support` and `system` map to NOTHING on purpose. A support reply and a
 * platform notice are the product answering something the person raised, and
 * there is no switch on `/settings` that claims to turn either off. Mapping
 * them to a topic would silence a message the product has promised to send,
 * which is the same argument `lib/notify/junction.ts` makes for having no
 * channel mute on a decision about your own listing.
 */
export const TOPIC_BY_KIND: Readonly<Partial<Record<NotificationKind, PushTopic>>> = {
  booking: "bookings",
  message: "messages",
  wallet: "wallet",
  listing: "listings",
  /* An agent notification is about the person's own listing business, which
     is the row the grid calls "Your listings". */
  agent: "listings",
  social: "social",
};

/**
 * The old booleans, by topic, for rule 2. Only four topics ever had one.
 */
const LEGACY_KEY_BY_TOPIC: Readonly<Partial<Record<PushTopic, string>>> = {
  bookings: "bookings",
  messages: "messages",
  wallet: "wallet",
  marketing: "marketing",
};

/**
 * WHICH KINDS GO THROUGH QUIET HOURS AT ANY HOUR.
 *
 * Only `wallet`, and the restraint is deliberate. The database already
 * refuses to let a wallet notification be silenced in app, on the argument
 * that money at risk is not a preference
 * (`20260804134543_...sql:17-22`), and extending that one existing decision
 * is better than inventing a second, different answer about what counts as
 * urgent.
 *
 * THE LIMITATION, STATED RATHER THAN HIDDEN. `notifications` carries a kind
 * and no severity, so this cannot tell "your withdrawal failed" from "your
 * wallet was credited", and it wakes somebody for both. Waking a person for a
 * credit they were not worried about is a smaller error than sitting on a
 * reversal until morning, so that is the direction chosen. The real fix is a
 * severity on the event (proposed in `docs/archive/BUILD_07_LEDGER.md`),
 * rather than a guess made here by reading titles,
 * which would be a parser over a person's content and would break the first
 * time the copy changed.
 */
const URGENT_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>(["wallet"]);

/** Does this notification ignore quiet hours? */
export function isUrgentKind(kind: NotificationKind): boolean {
  return URGENT_KINDS.has(kind);
}

/**
 * Does this person want this kind of thing pushed to a device?
 *
 * See the reading rules at the head. Never throws: every access is guarded,
 * because this runs inside the drain and a malformed settings document on one
 * person's profile must not stop the queue for everybody else.
 */
export function wantsPush(settings: unknown, kind: NotificationKind): boolean {
  const topic = TOPIC_BY_KIND[kind];

  /* No topic means no switch claims to govern it. Deliver. */
  if (!topic) return true;

  const notifications = readObject(settings, "notifications");

  /* RULE 1. An explicit channel answer wins over everything. */
  const channels = readObject(notifications, "channels");
  const forTopic = readObject(channels, topic);
  if (forTopic && typeof forTopic.push === "boolean") {
    return forTopic.push;
  }

  /* RULE 2. The old boolean, which governed every channel there was. */
  const legacyKey = LEGACY_KEY_BY_TOPIC[topic];
  /* Not for marketing (4 November 2026): the old `marketing` boolean is the
     marketing EMAIL switch and is now on by default, so it must not also open
     marketing pushes. A push needs its own explicit channel answer (rule 1). */
  if (topic !== "marketing" && legacyKey && notifications && typeof notifications[legacyKey] === "boolean") {
    return notifications[legacyKey] as boolean;
  }

  /* RULE 3, and its one exception. */
  if (topic === "marketing") return false;
  return true;
}

function readObject(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next = (value as Record<string, unknown>)[key];
  if (!next || typeof next !== "object" || Array.isArray(next)) return null;
  return next as Record<string, unknown>;
}
