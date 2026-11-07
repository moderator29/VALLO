/**
 * NEW NOTICES AND GENTLE NUDGES (FEATURE_BACKLOG A5 and A6), THE PURE HALF.
 *
 * The database does the sending (`supabase/migrations/pending/
 * features_a5_a6_notices.sql`): one daily run for the new notices, one for
 * the nudges, both inside Lagos daytime. This file holds what the app needs
 * to draw the switches and what the tests pin the SQL to:
 *
 *   - the topics a person can switch, in the order they are drawn;
 *   - the nudge caps (one a week per person, so never two kinds in a day,
 *     and each kind stops after three);
 *   - `nudgeAllowed`, the same rule as `private.may_nudge`, so the rule is a
 *     unit test and not only a line of SQL.
 *
 * WHAT ALREADY EXISTED AND IS NOT DUPLICATED: price drops and a saved place
 * back on the market (`private.record_listing_change`), a viewing tomorrow
 * (`private.send_viewing_reminders`), a stay check-in tomorrow and the review
 * after a stay or a meal (`private.send_stay_reminders`), new listings for a
 * saved search (`new-match-alerts`, `saved-search-alerts`). The area digest
 * leaves out anybody with a saved search alert on, so nobody hears the same
 * listing twice.
 *
 * A MISSING ROW MEANS ON. Only an explicit off silences, the way
 * `private.notify` reads the older switches.
 */

export const NOTICE_TOPICS = [
  "new_in_area",
  "new_neighbours",
  "move_in_review",
  "nudges",
  "nudge_phone",
  "nudge_identity",
  "nudge_listing_draft",
  "nudge_profile",
] as const;

export type NoticeTopic = (typeof NOTICE_TOPICS)[number];

export const NUDGE_TOPICS = [
  "nudge_phone",
  "nudge_identity",
  "nudge_listing_draft",
  "nudge_profile",
] as const satisfies readonly NoticeTopic[];

export type NudgeTopic = (typeof NUDGE_TOPICS)[number];

/** One nudge a week per person, which also means never two kinds in a day. */
export const NUDGE_GAP_DAYS = 7;
/** A nudge kind stops for good after this many. */
export const NUDGE_MAX_PER_KIND = 3;

export function isNoticeTopic(value: unknown): value is NoticeTopic {
  return typeof value === "string" && (NOTICE_TOPICS as readonly string[]).includes(value);
}

export type NoticePreferences = Record<NoticeTopic, boolean>;

/** Everything on: what a person who never touched a switch has. */
export function defaultPreferences(): NoticePreferences {
  return Object.fromEntries(NOTICE_TOPICS.map((t) => [t, true])) as NoticePreferences;
}

/** Fold stored rows onto the defaults. Malformed rows are skipped. */
export function preferencesFromRows(rows: readonly { topic?: unknown; enabled?: unknown }[] | null | undefined): NoticePreferences {
  const out = defaultPreferences();
  for (const row of rows ?? []) {
    if (isNoticeTopic(row.topic) && row.enabled === false) out[row.topic] = false;
  }
  return out;
}

export type NudgeSent = { nudge: string; sentAt: string };

/**
 * May this person be sent this nudge now? The same rule as
 * `private.may_nudge`: all nudges on, this kind on, fewer than three of this
 * kind ever, and no nudge of any kind in the last seven days.
 */
export function nudgeAllowed(input: {
  nudge: NudgeTopic;
  preferences: NoticePreferences;
  sent: readonly NudgeSent[];
  now: number;
}): boolean {
  if (!input.preferences.nudges || !input.preferences[input.nudge]) return false;
  const ofKind = input.sent.filter((s) => s.nudge === input.nudge).length;
  if (ofKind >= NUDGE_MAX_PER_KIND) return false;
  const gap = NUDGE_GAP_DAYS * 86_400_000;
  return !input.sent.some((s) => {
    const at = Date.parse(s.sentAt);
    return Number.isFinite(at) && input.now - at < gap;
  });
}

/**
 * The order the run tries the nudges in, most useful first. A person gets the
 * first one they are owed and allowed, never more than one.
 */
export const NUDGE_ORDER: readonly NudgeTopic[] = [
  "nudge_identity",
  "nudge_phone",
  "nudge_listing_draft",
  "nudge_profile",
];

export function chooseNudge(owed: ReadonlySet<NudgeTopic>, allowed: (n: NudgeTopic) => boolean): NudgeTopic | null {
  for (const nudge of NUDGE_ORDER) {
    if (owed.has(nudge) && allowed(nudge)) return nudge;
  }
  return null;
}

/* ------------------------------------------------------------------ words */

/**
 * The lock screen words the SQL writes, kept here so a test holds the two
 * together and the settings screen can show an example. Title is the header
 * line (40 characters or fewer), body the one sentence (110 or fewer), the
 * rules of `lib/push/copy.ts`.
 */
export const NUDGE_WORDS: Record<NudgeTopic, { title: string; body: string; href: string }> = {
  nudge_identity: {
    title: "Verify before you rent",
    body: "Rentals of 5 months or more need an ID check before you pay. It takes about five minutes.",
    href: "/verification",
  },
  nudge_phone: {
    title: "Confirm your phone",
    body: "Confirm it now and your first booking or rent payment is one step shorter.",
    href: "/settings/phone",
  },
  nudge_listing_draft: {
    title: "Your listing is waiting",
    body: "is saved as a draft. Pick up where you left off.",
    href: "/agent/list?id=",
  },
  nudge_profile: {
    title: "Add a profile photo",
    body: "A photo helps the people you deal with know it is you.",
    href: "/profile/setup",
  },
};

/** The area digest's words, as the SQL builds them. */
export function areaDigestWords(input: { areaName: string; count: number; newestNoun: string }): { title: string; body: string } {
  const title = `New in ${input.areaName}`.slice(0, 40);
  const body =
    input.count === 1
      ? `A ${input.newestNoun} just listed near you.`
      : `${input.count} new places listed near you today.`;
  return { title, body };
}

/** The plain word for a listing, the same as `private.listing_noun`. */
export function listingNoun(type: string | null, bedrooms: number | null, intent: string | null): string {
  const rooms =
    (bedrooms ?? 0) > 0 && type !== null && ["apartment", "home", "villa", "rental", "shortlet"].includes(type)
      ? `${bedrooms} bedroom `
      : "";
  const NOUN: Record<string, string> = {
    apartment: "flat",
    home: "house",
    villa: "villa",
    shortlet: "shortlet",
    shop: "shop",
    office: "office",
    land: "plot of land",
  };
  const noun = (type && NOUN[type]) || "place";
  return `${rooms}${noun}${intent === "sale" ? " for sale" : ""}`;
}

/** The new neighbours digest's words, as the SQL builds them. */
export function neighboursWords(input: { firstName: string | null; count: number; areaName: string | null; areas: number }): string {
  const who = input.firstName?.trim() || "Someone you follow";
  const more =
    input.count === 1 ? "" : input.count === 2 ? " and 1 other you follow" : ` and ${input.count - 1} others you follow`;
  const where = input.areas === 1 ? ` joined ${input.areaName ?? "your area"}.` : " joined your areas.";
  return `${who}${more}${where}`.slice(0, 110);
}
