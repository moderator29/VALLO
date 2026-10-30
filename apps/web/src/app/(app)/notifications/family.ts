import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { IconPlateTone } from "@/components/ui/IconPlate";
import type { Icon3DName } from "@/components/ui/icon-3d";

/**
 * WHICH FAMILY A NOTIFICATION BELONGS TO, AND WHAT CAN HONESTLY BE READ OFF IT.
 *
 * `public.notifications` is a flat row: a kind (eight values), a title, a body
 * and an in-app link, all written by database triggers. It carries no family,
 * no figure, no actor and no object id (requests W5-1 and W5-2 in the
 * response file ask Session 2 for them). Until they exist the centre has to
 * PRESENT, never decide, so every rule here reads only the three fields the
 * row really has, in this order: the link (the strongest statement of what
 * the row is about), then the words the trigger wrote, then the kind.
 *
 * The six filter chips of the north star (16.4) are the families. The social
 * events of section 16.2 (a follow, a reply, a mention) join Messages, because
 * they are people reaching you, which is what that chip is for.
 *
 * Pure: no React, no reads, so the whole table is tested.
 */

export type NotificationFamily = "money" | "trust" | "spaces" | "messages" | "account";

export const FAMILY_ORDER: readonly NotificationFamily[] = ["money", "trust", "spaces", "messages", "account"];

type Facts = { kind: string; title: string; href: string | null };

/** Link prefixes that settle the family on their own. Longest and most specific first. */
const HREF_FAMILY: readonly { prefix: RegExp; family: NotificationFamily }[] = [
  { prefix: /^\/(?:agent\/|host\/)?messages(?:[/?#]|$)/, family: "messages" },
  { prefix: /^\/(?:around|post|stories|u)(?:[/?#]|$)/, family: "messages" },
  { prefix: /^\/(?:payments|checkout|rent|wallet|pay|record|earnings)(?:[/?#]|$)/, family: "money" },
  { prefix: /^\/(?:host|agent)\/earnings(?:[/?#]|$)/, family: "money" },
  { prefix: /^\/settings\/payments(?:[/?#]|$)/, family: "money" },
  { prefix: /^\/(?:verification|verify|passport)(?:[/?#]|$)/, family: "trust" },
  { prefix: /^\/settings\/passport(?:[/?#]|$)/, family: "trust" },
  { prefix: /^\/settings\/(?:devices|passcode|phone|account|privacy)(?:[/?#]|$)/, family: "account" },
  { prefix: /^\/(?:support|help)(?:[/?#]|$)/, family: "account" },
];

/** What the trigger wrote, when the link did not decide. Case-insensitive. */
const MONEY_WORDS = /\b(rent|payment|paid|pay|refund|deposit|caution|withdraw\w*|wallet|escrow|share|payout|receipt|statement|charge\w*|invoice|balance|fee|plan renew\w*)\b|₦/i;
const TRUST_WORDS = /\b(verif\w*|badge|passport|mandate|identity|document|streak|record)\b/i;
const ACCOUNT_WORDS = /\b(sign-?in|device|passcode|password|e-?mail|phone number|security|support ticket|ticket|data export|deletion)\b/i;

/** A ring or a missed call, written by the call triggers as "Incoming video call" or "Missed voice call from Ada". */
const CALL_TITLE = /^(?:incoming|missed) (?:voice|video) call\b/i;

export function isCallRow(n: { title: string }): boolean {
  return CALL_TITLE.test(n.title.trim());
}

/** The row's glyph: a call is a handset, never a chat bubble. */
export function glyphOf(n: Facts): UiIconName {
  return isCallRow(n) ? "phone" : FAMILY_GLYPH[familyOf(n)];
}

export function familyOf(n: Facts): NotificationFamily {
  /* The kinds that mean one thing wherever they point. */
  if (n.kind === "message") return "messages";
  if (n.kind === "wallet") return "money";
  if (n.kind === "support") return "account";

  const href = n.href ?? "";
  for (const rule of HREF_FAMILY) {
    if (rule.prefix.test(href)) return rule.family;
  }

  const words = n.title;
  if (n.kind === "social") return TRUST_WORDS.test(words) && /earned/i.test(words) ? "trust" : "messages";
  /* A listing's own events (submitted, approved, needs more information) are
     supply, so they stay Spaces even when the word "verified" is in them. */
  if (n.kind === "listing") return "spaces";
  if (MONEY_WORDS.test(words)) return "money";
  if (TRUST_WORDS.test(words)) return "trust";
  if (n.kind === "system") return "account";
  if (ACCOUNT_WORDS.test(words)) return "account";
  /* booking, agent and anything new: a space, a stay or a tenancy. */
  return "spaces";
}

/** The line glyph on the round plate of a row, per family. */
export const FAMILY_GLYPH: Record<NotificationFamily, UiIconName> = {
  money: "wallet",
  trust: "verified",
  spaces: "house",
  messages: "chat-bubble",
  account: "user",
};

/** The plate tint. The glyph and the word say what it is; the tint only sorts. */
export const FAMILY_TONE: Record<NotificationFamily, IconPlateTone> = {
  money: "success",
  trust: "brand",
  spaces: "brand",
  messages: "info",
  account: "neutral",
};

/** The one clay object of the full view, per family (tier B symbols). */
export const FAMILY_OBJECT: Record<NotificationFamily, Icon3DName> = {
  money: "pay",
  trust: "shield",
  spaces: "home-small",
  messages: "envelope",
  account: "passcode-lock",
};

/* ------------------------------------------------------------------ figure */

const FIGURE = /(?:₦|NGN\s?)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;

/**
 * The naira figure the trigger's own words state, in kobo, or null.
 *
 * Only an unambiguous one is returned: exactly one distinct amount across the
 * title and body. Two different amounts (a rent and a deposit, say) are not
 * guessed between, because choosing the wrong one for a headline figure is
 * worse than showing none; the words themselves are always drawn beside it.
 */
export function figureIn(...texts: (string | null | undefined)[]): number | null {
  const found = new Set<number>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(FIGURE)) {
      const whole = Number(match[1]!.replace(/,/g, ""));
      const kobo = match[2] ? Number(match[2].padEnd(2, "0")) : 0;
      const minor = whole * 100 + kobo;
      if (Number.isSafeInteger(minor)) found.add(minor);
    }
  }
  return found.size === 1 ? [...found][0]! : null;
}

/* ------------------------------------------------------------------ object */

export type ObjectKey =
  | "booking"
  | "payment"
  | "agreement"
  | "tenancy"
  | "inspection"
  | "conversation"
  | "space"
  | "verification"
  | "passport"
  | "ticket"
  | "post"
  | "profile"
  | "setting"
  | "workspace"
  | "page";

const OBJECTS: readonly { prefix: RegExp; key: ObjectKey }[] = [
  { prefix: /^\/(?:agent\/|host\/)?messages(?:[/?#]|$)/, key: "conversation" },
  { prefix: /^\/bookings(?:[/?#]|$)/, key: "booking" },
  { prefix: /^\/trips(?:[/?#]|$)/, key: "booking" },
  /* A rent payment is a payment. `/wallet` only redirects now and there is no
     wallet to open (D48), so an old row pointing at it is a payment too. */
  { prefix: /^\/(?:payments|checkout|pay|record|rent|wallet)(?:[/?#]|$)/, key: "payment" },
  { prefix: /^\/agreements(?:[/?#]|$)/, key: "agreement" },
  { prefix: /^\/tenancy(?:[/?#]|$)/, key: "tenancy" },
  { prefix: /^\/inspections(?:[/?#]|$)/, key: "inspection" },
  { prefix: /^\/(?:listing|stay|restaurant)(?:[/?#]|$)/, key: "space" },
  { prefix: /^\/verification(?:[/?#]|$)/, key: "verification" },
  { prefix: /^\/settings\/passport(?:[/?#]|$)/, key: "passport" },
  { prefix: /^\/support(?:[/?#]|$)/, key: "ticket" },
  { prefix: /^\/post(?:[/?#]|$)/, key: "post" },
  { prefix: /^\/u(?:[/?#]|$)/, key: "profile" },
  { prefix: /^\/settings(?:[/?#]|$)/, key: "setting" },
  { prefix: /^\/(?:host|agent)(?:[/?#]|$)/, key: "workspace" },
];

/** The noun the link to the underlying object is called. */
export function objectOf(href: string | null): ObjectKey {
  if (!href) return "page";
  for (const rule of OBJECTS) if (rule.prefix.test(href)) return rule.key;
  return "page";
}

/* ----------------------------------------------------------------- grouping */

/** An id-shaped last segment: a uuid, a long token or a number. */
const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{12,}|\d+)$/i;

/**
 * The record a row is about, or null when its link is a general page.
 *
 * Several events on one record fold into one expandable row, but only where
 * the link names ONE record (a booking, a conversation, a post). `/settings`
 * or `/wallet` is a place, not a record, so two rows pointing at it are two
 * things and stay two rows.
 */
export function objectKeyOf(href: string | null): string | null {
  if (!href) return null;
  const path = href.split(/[?#]/)[0]!;
  const last = path.split("/").filter(Boolean).at(-1);
  if (!last || !ID_SEGMENT.test(last)) return null;
  return path;
}

export type Group<T> = { key: string; lead: T; rows: T[] };

/**
 * Fold rows that share a record into one group, keeping the order of each
 * group's newest row (the input is newest first).
 */
export function groupByObject<T extends { id: string; href: string | null; title?: string }>(rows: readonly T[]): Group<T>[] {
  const out: Group<T>[] = [];
  const at = new Map<string, Group<T>>();
  for (const row of rows) {
    const path = objectKeyOf(row.href);
    /* Calls fold only with calls, so a ring never hides inside "3 new messages". */
    const key = path && row.title !== undefined && isCallRow({ title: row.title }) ? `call:${path}` : path;
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
