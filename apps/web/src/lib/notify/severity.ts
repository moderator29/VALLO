/**
 * WHAT NEEDS YOU (recommendation B11, 30 September 2026).
 *
 * `notifications` carries a kind and no severity (`lib/push/preferences.ts`
 * said so), so "your agreement is waiting for your confirmation" and "Tunde
 * liked your post" weighed the same. This is the severity table:
 *
 *   action   something only you can move, with one verb that does it
 *   update   a record you care about changed; nothing is asked of you
 *   fyi      good to know; never wakes the phone
 *
 * THE TABLE IS A DRAFT FOR THE FOUNDER'S SIGN-OFF (docs/recs/RECS_B,
 * "B11 severity table"). These are the defaults meanwhile. The same table is
 * mirrored in SQL (`public.notification_severity`, migration
 * `20260930104610_m1_b11_b13_severity_and_saved_changes`), which stamps new rows; until that
 * is applied, and for any row written before it, the app reads the severity
 * from here. The rules read the kind, the title the database trigger wrote
 * and the in-app destination, in order; the first that matches wins.
 *
 * Pure: no React, no reads.
 */

export type Severity = "action" | "update" | "fyi";

/** The one verb an action row offers inline. Words live in the dictionary. */
export type SeverityVerb = "reply" | "confirm" | "review" | "addDetails" | "check" | "renew" | "open";

export type SeverityRule = {
  /** What the founder reads in the sign-off table. */
  describes: string;
  kind?: readonly string[];
  title?: RegExp;
  href?: RegExp;
  severity: Severity;
  verb?: SeverityVerb;
};

export const SEVERITY_RULES: readonly SeverityRule[] = [
  { describes: "A new sign-in to your account", href: /^\/settings\/devices\/alert/, severity: "action", verb: "check" },
  { describes: "A new message in a conversation", kind: ["message"], title: /^new message/i, severity: "action", verb: "reply" },
  { describes: "Confirm who you are letting for", title: /confirm who you are letting for/i, severity: "action", verb: "confirm" },
  { describes: "A new booking or table request (host)", title: /^(new booking request|table requested)/i, severity: "action", verb: "review" },
  { describes: "An application needs more information", title: /needs more information/i, severity: "action", verb: "addDetails" },
  { describes: "A withdrawal or payment could not complete", title: /could not complete/i, severity: "action", verb: "check" },
  { describes: "Your mandate is running out", title: /mandate is running out/i, severity: "action", verb: "renew" },
  { describes: "You were invited to share a move-in", title: /invited to share a move-in/i, severity: "action", verb: "open" },
  { describes: "A held payment is paused", title: /held payment is paused/i, severity: "action", verb: "open" },
  { describes: "A new support ticket (staff)", title: /^a new support ticket/i, severity: "action", verb: "open" },
  { describes: "Likes, reposts, new followers and badges", kind: ["social"], title: /(liked|reposted|new follower|you earned)/i, severity: "fyi" },
  { describes: "Your post, story, event, bio or comment is live or being looked at", title: /( is live$| is being checked$)/i, severity: "fyi" },
  { describes: "We received your question; your request was sent", title: /^(we have your question|booking request sent)/i, severity: "fyi" },
  { describes: "Anything else from the feed", kind: ["social"], severity: "fyi" },
  { describes: "Any other message", kind: ["message"], severity: "action", verb: "reply" },
];

/** Everything no rule names: a record you care about changed. */
export const DEFAULT_SEVERITY: Severity = "update";

export type SeverityVerdict = { severity: Severity; verb?: SeverityVerb };

export function severityOf(n: { kind: string; title: string; href: string | null }): SeverityVerdict {
  for (const rule of SEVERITY_RULES) {
    if (rule.kind && !rule.kind.includes(n.kind)) continue;
    if (rule.title && !rule.title.test(n.title.trim())) continue;
    if (rule.href && !(n.href && rule.href.test(n.href))) continue;
    return rule.verb ? { severity: rule.severity, verb: rule.verb } : { severity: rule.severity };
  }
  return { severity: DEFAULT_SEVERITY };
}

/** A stored severity when the row carries one (after the migration), else the table's. */
export function readSeverity(n: {
  kind: string;
  title: string;
  href: string | null;
  severity?: string | null;
}): SeverityVerdict {
  const table = severityOf(n);
  if (n.severity === "action" || n.severity === "update" || n.severity === "fyi") {
    return n.severity === table.severity ? table : { severity: n.severity };
  }
  return table;
}

/* ------------------------------------------------------------- bundles */

/**
 * BUNDLES: rows about one record become one row. Five messages in one thread
 * are "5 new messages" that opens to the five; three likes on one post, one
 * row. Only kinds where repetition is the noise bundle (messages and the
 * feed), keyed by the record's own address; everything else stays one row
 * each, because two bookings are two things.
 */
export function bundleKey(n: { kind: string; href: string | null; title?: string }): string | null {
  if (!n.href) return null;
  /* A ring or a missed call is not a message: it bundles only with calls. */
  if (n.kind === "message" && n.title && /^(?:incoming|missed) (?:voice|video) call\b/i.test(n.title.trim())) {
    return `call:${n.href.split("?")[0]}`;
  }
  if (n.kind === "message" || n.kind === "social") return `${n.kind}:${n.href.split("?")[0]}`;
  return null;
}

export type Bundle<T> = { key: string; lead: T; rows: T[] };

/** Group rows into bundles, keeping the order of each bundle's newest row. */
export function bundle<T extends { id: string; kind: string; href: string | null; title?: string }>(rows: readonly T[]): Bundle<T>[] {
  const out: Bundle<T>[] = [];
  const at = new Map<string, Bundle<T>>();
  for (const row of rows) {
    const key = bundleKey(row);
    if (key) {
      const existing = at.get(key);
      if (existing) {
        existing.rows.push(row);
        continue;
      }
      const fresh = { key, lead: row, rows: [row] };
      at.set(key, fresh);
      out.push(fresh);
      continue;
    }
    out.push({ key: row.id, lead: row, rows: [row] });
  }
  return out;
}
