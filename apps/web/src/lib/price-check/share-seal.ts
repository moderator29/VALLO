import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { shareAreaSchema } from "./schema";
import type { AreaAskingRow, ListingIntent, PriceCheckPropertyType } from "./types";

/**
 * THE FIGURES ON A SHARE CARD ARE THE SERVER'S, SEALED WHEN THEY ARE COMPUTED.
 *
 * `shareAreaPrices` is a public HTTP endpoint. Until this seal it took the low,
 * middle and high figures and the listing count from the caller, so anybody
 * could mint a Vallo-branded card saying a two-bed in Yaba asks one naira, or
 * one billion. A card is a claim the product makes in its own name; it may
 * only carry a figure the product computed.
 *
 * Recomputing at mint time works for an area report row (the action has the
 * state, area, type and bedrooms) but not for the gate's range, which is built
 * around the precise pin, and the pin is exactly what the share path is never
 * given. So the page that computes the figures seals the WHOLE card (place,
 * type, intent, bedrooms, figures, count, dates) with an HMAC, the client
 * carries the seal as an opaque string, and the action mints only what a valid,
 * unexpired seal says. Nothing on the card comes from the client any more,
 * which also closes the quieter bug: a person who edited the form after the
 * answer arrived used to mint the new area's name with the old area's figures.
 *
 *     v1.<card JSON, base64url>.<HMAC-SHA256, base64url>
 *
 * The key is derived from the service role key under its own purpose label,
 * the pattern of `lib/passcode/unlock-cookie.ts` and
 * `lib/email/unsubscribe-token.ts`: no new secret to provision, and a seal can
 * never be replayed as another purpose's token. No key, no seal, and minting
 * answers with its failure line (it could not write the row without that key
 * anyway).
 *
 * Replaying a seal mints another card with the same true figures, which the
 * per person rate limit in the action already bounds. The seal expires so a
 * stale answer cannot be minted next month.
 */

export type ShareCard = z.infer<typeof shareAreaSchema>;

const VERSION = "v1";
/** A result left open in a tab for a day can still be shared; a week-old one cannot. */
export const SHARE_SEAL_LIFETIME_SECONDS = 24 * 60 * 60;
const MAX_SEAL_LENGTH = 2048;

export function shareSealKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const secret = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (secret.length < 16) return null;
  return createHmac("sha256", secret).update("vallo.price-check.share.v1").digest();
}

function mac(key: Buffer, body: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

/** Seal one card, or null when the card is not one the schema would mint. */
export function sealShareCard(key: Buffer, card: ShareCard, nowSeconds: number): string | null {
  const parsed = shareAreaSchema.safeParse(card);
  if (!parsed.success) return null;
  const payload = Buffer.from(
    JSON.stringify({ card: parsed.data, exp: nowSeconds + SHARE_SEAL_LIFETIME_SECONDS }),
  ).toString("base64url");
  const body = `${VERSION}.${payload}`;
  return `${body}.${mac(key, body)}`;
}

/** The card inside a valid, unexpired seal, or null for anything else. */
export function openShareSeal(key: Buffer, seal: string | null | undefined, nowSeconds: number): ShareCard | null {
  if (!seal || seal.length > MAX_SEAL_LENGTH) return null;
  const parts = seal.split(".");
  if (parts.length !== 3) return null;
  const [version = "", payload = "", signature = ""] = parts;
  if (version !== VERSION) return null;
  const expected = Buffer.from(mac(key, `${version}.${payload}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof decoded !== "object" || decoded === null) return null;
  const { card, exp } = decoded as { card?: unknown; exp?: unknown };
  if (typeof exp !== "number" || exp <= nowSeconds) return null;
  const parsed = shareAreaSchema.safeParse(card);
  return parsed.success ? parsed.data : null;
}

/* ------------------------------------------------- what a card is made of */

type Place = {
  stateCode: string;
  lgaCode: string | null;
  area: string | null;
  intent: ListingIntent;
};

/**
 * An area row's property type, narrowed onto the four a card may carry.
 *
 * `area_asking_summary` answers for every type the database holds, including
 * land, hotels and restaurants, and `price_check_shares.property_type` would
 * accept any of them, but a card built from one would be a price claim about a
 * kind of property this product refuses to price, which is what
 * `unsupported_type` exists to say. So an unsupported row gets an AREA scoped
 * card, which names the neighbourhood and no type.
 */
function asSupportedType(value: string): PriceCheckPropertyType | null {
  return value === "apartment" || value === "home" || value === "shop" || value === "office"
    ? value
    : null;
}

function cardOf(
  place: Place,
  propertyType: PriceCheckPropertyType | null,
  bedrooms: number | null,
  figures: { low: number; mid: number; high: number; count: number; oldestAt?: string | null; newestAt?: string | null },
): ShareCard {
  /* The scope is derived from what we hold, never chosen: the database refuses
     an `area` card carrying a type and an `area_and_type` card carrying none. */
  return {
    scope: propertyType ? "area_and_type" : "area",
    stateCode: place.stateCode,
    ...(place.lgaCode ? { lgaCode: place.lgaCode } : {}),
    ...(place.area ? { area: place.area } : {}),
    ...(propertyType ? { propertyType } : {}),
    listingIntent: place.intent,
    ...(propertyType && bedrooms !== null ? { bedrooms } : {}),
    lowMinor: Math.round(figures.low),
    midMinor: Math.round(figures.mid),
    highMinor: Math.round(figures.high),
    listingCount: figures.count,
    ...(figures.oldestAt ? { oldestAt: figures.oldestAt } : {}),
    ...(figures.newestAt ? { newestAt: figures.newestAt } : {}),
  };
}

/** The card for the gate's answered range, from the query that produced it. */
export function cardFromAnswer(
  place: Place & { propertyType: PriceCheckPropertyType; bedrooms: number | null },
  answer: { lowMinor: number; midMinor: number; highMinor: number; comparableCount: number },
): ShareCard {
  return cardOf(place, place.propertyType, place.bedrooms, {
    low: answer.lowMinor,
    mid: answer.midMinor,
    high: answer.highMinor,
    count: answer.comparableCount,
  });
}

/** The card for one area report row: its quartiles, not the gate's range. */
export function cardFromAreaRow(place: Place, row: AreaAskingRow): ShareCard {
  return cardOf(place, asSupportedType(row.propertyType), row.bedrooms, {
    low: row.p25Minor,
    mid: row.medianMinor,
    high: row.p75Minor,
    count: row.listingCount,
    oldestAt: row.oldestAt || null,
    newestAt: row.newestAt || null,
  });
}

/** Seal with this server's key, or null when it has none. */
export function sealWithServerKey(card: ShareCard, nowSeconds: number = Math.floor(Date.now() / 1000)): string | null {
  const key = shareSealKey();
  return key ? sealShareCard(key, card, nowSeconds) : null;
}
