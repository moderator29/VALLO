import { formatMoney, type Dictionary } from "@vallo/i18n/core";

import { placeText } from "@/components/roommates/format";
import { stateName } from "@/components/roommates/states";
import { ROOMMATES_ROUTES, type RoomDetail, type RoommateProfileView } from "@/lib/features/roommates/model";

/**
 * A ROOMMATES CARD ON A CIRCLE POST (founder, 10 November 2026: "sharing a
 * Roommates link into a Circle"). The pure half: what the card may hold, how
 * it is built from a page the sharer can already see, and how a stored card is
 * read back.
 *
 * THE RULE. A card holds only what the page it links to already shows:
 *   - a room post: its title, its area and city, its kind and its price;
 *   - a person: their FIRST NAME only, their school and area, and what they
 *     are here for.
 * It never holds a phone number, an email, a handle, a photograph, a street
 * address, a workplace, a gender, an age, a budget or a message. The set of
 * keys is closed (`CARD_KEYS`); the database holds the same list
 * (`circle_roommate_card_2026-11-10.sql`) so a card written around this file
 * is refused there too.
 */

export type RoommatesWords = Dictionary["roommates"];

export const CARD_KINDS = ["room", "person"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

/** The closed set of keys a stored card may have. */
export const CARD_KEYS = ["v", "kind", "ref", "title", "place", "summary"] as const;

export type CircleRoommateCard = {
  v: 1;
  kind: CardKind;
  /** The room post's id, or the person's user id. The link is built from it, never stored. */
  ref: string;
  /** A room post's title, or a person's first name. */
  title: string;
  /** School and area for a person, area and city for a room. */
  place: string;
  /** What is on offer or wanted, in a line. */
  summary: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CARD_LIMITS = { title: 140, place: 160, summary: 200 } as const;

/** The signs of a contact detail: an at sign, a link, or a run of seven digits. A card never carries one. */
export function looksLikeContact(text: string): boolean {
  if (/@|https?:|www\./i.test(text)) return true;
  return (text.match(/\d[\d\s().+-]*\d/g) ?? []).some((run) => run.replace(/\D/g, "").length >= 7);
}

const clip = (text: string, max: number) => text.trim().replace(/\s+/g, " ").slice(0, max);

/** A room post as a card. Only a live post can be shared; the caller checks that. */
export function buildRoomCard(l: RoomDetail, t: RoommatesWords): CircleRoommateCard {
  const price = l.shareMinor ?? l.rentMinor;
  const priceLine = price !== null ? `${formatMoney(price, "en")}${t.perPeriod[l.rentPeriod] ?? ""}` : null;
  return {
    v: 1,
    kind: "room",
    ref: l.id,
    title: clip(l.title, CARD_LIMITS.title),
    place: clip(placeText(l.area, l.city, stateName(l.stateCode)) ?? "", CARD_LIMITS.place),
    summary: clip([t.listingKinds[l.kind], priceLine].filter(Boolean).join(" · "), CARD_LIMITS.summary),
  };
}

/** A person as a card: first name, school and area, what they are here for. */
export function buildPersonCard(p: RoommateProfileView, t: RoommatesWords): CircleRoommateCard {
  const first = p.name.trim().split(/\s+/)[0] ?? "";
  const school = p.institution ? (p.institution.shortName ?? p.institution.name) : null;
  const place = placeText(school, ...p.areas.slice(0, 2), p.city, stateName(p.stateCode)) ?? "";
  const intents = p.intents.slice(0, 2).map((i) => t.intents[i]);
  const summary = intents.length ? intents.join(" · ") : p.lifeStage ? t.lifeStages[p.lifeStage] : "";
  return {
    v: 1,
    kind: "person",
    ref: p.userId,
    title: clip(first, CARD_LIMITS.title),
    place: clip(place, CARD_LIMITS.place),
    summary: clip(summary, CARD_LIMITS.summary),
  };
}

/**
 * Read a stored card back. Strict: a wrong shape, an unknown key, a bad id or
 * anything that looks like a contact detail reads as no card at all, so a row
 * written around the action never draws.
 */
export function readCard(raw: unknown): CircleRoommateCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (Object.keys(o).some((k) => !(CARD_KEYS as readonly string[]).includes(k))) return null;
  if (o.v !== 1 || (o.kind !== "room" && o.kind !== "person")) return null;
  if (typeof o.ref !== "string" || !UUID.test(o.ref)) return null;
  const { title, place, summary } = o;
  if (typeof title !== "string" || typeof place !== "string" || typeof summary !== "string") return null;
  if (!title.trim() || title.length > CARD_LIMITS.title || place.length > CARD_LIMITS.place || summary.length > CARD_LIMITS.summary) return null;
  if ([title, place, summary].some(looksLikeContact)) return null;
  return { v: 1, kind: o.kind, ref: o.ref, title, place, summary };
}

/** The real page a card links to. */
export function cardHref(card: Pick<CircleRoommateCard, "kind" | "ref">): string {
  return card.kind === "room" ? ROOMMATES_ROUTES.listing(card.ref) : ROOMMATES_ROUTES.person(card.ref);
}

/** The title of the Circle post that carries the card. */
export function postTitleFor(card: CircleRoommateCard, t: RoommatesWords): string {
  const title = card.kind === "room" ? card.title : t.circleShare.personTitle.replace("{name}", card.title);
  return title.length >= 3 ? title : t.circleShare.personTitle.replace("{name}", title);
}
