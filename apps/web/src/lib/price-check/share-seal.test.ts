import { describe, expect, it } from "vitest";
import {
  SHARE_SEAL_LIFETIME_SECONDS,
  cardFromAnswer,
  cardFromAreaRow,
  openShareSeal,
  sealShareCard,
  shareSealKey,
} from "./share-seal";

const KEY = shareSealKey({ SUPABASE_SERVICE_ROLE_KEY: "a-service-role-key-long-enough" })!;
const OTHER = shareSealKey({ SUPABASE_SERVICE_ROLE_KEY: "a-different-service-role-key" })!;
const NOW = 1_800_000_000;
const PLACE = { stateCode: "LA", lgaCode: null, area: "Yaba", intent: "rent" as const };

const ROW = {
  scope: "area" as const,
  propertyType: "apartment" as const,
  bedrooms: 2,
  listingCount: 7,
  p25Minor: 450_000_000,
  medianMinor: 520_000_000,
  p75Minor: 600_000_000,
  sizedCount: 0,
  medianPerSqmMinor: null,
  oldestAt: "2026-03-04T00:00:00Z",
  newestAt: "2026-08-21T00:00:00Z",
};

describe("share seals", () => {
  it("has no key without a long enough service key", () => {
    expect(shareSealKey({})).toBeNull();
    expect(shareSealKey({ SUPABASE_SERVICE_ROLE_KEY: "short" })).toBeNull();
  });

  it("opens to exactly the card that was sealed", () => {
    const card = cardFromAreaRow(PLACE, ROW);
    const seal = sealShareCard(KEY, card, NOW)!;
    expect(openShareSeal(KEY, seal, NOW + 60)).toEqual(card);
  });

  it("refuses another key, an expired seal, a tampered card and junk", () => {
    const seal = sealShareCard(KEY, cardFromAreaRow(PLACE, ROW), NOW)!;
    expect(openShareSeal(OTHER, seal, NOW)).toBeNull();
    expect(openShareSeal(KEY, seal, NOW + SHARE_SEAL_LIFETIME_SECONDS)).toBeNull();
    const [v, payload, mac] = seal.split(".");
    const body = JSON.parse(Buffer.from(String(payload), "base64url").toString("utf8"));
    body.card.highMinor = 999_999_999_999;
    expect(openShareSeal(KEY, `${v}.${Buffer.from(JSON.stringify(body)).toString("base64url")}.${mac}`, NOW)).toBeNull();
    body.exp = NOW + 10 * SHARE_SEAL_LIFETIME_SECONDS;
    expect(openShareSeal(KEY, `${v}.${Buffer.from(JSON.stringify(body)).toString("base64url")}.${mac}`, NOW)).toBeNull();
    expect(openShareSeal(KEY, "", NOW)).toBeNull();
    expect(openShareSeal(KEY, "v1.e30.x", NOW)).toBeNull();
    expect(openShareSeal(KEY, "x".repeat(5000), NOW)).toBeNull();
  });

  it("seals nothing the schema would not mint", () => {
    expect(sealShareCard(KEY, { ...cardFromAreaRow(PLACE, ROW), listingCount: 2 }, NOW)).toBeNull();
    expect(sealShareCard(KEY, { ...cardFromAreaRow(PLACE, ROW), lowMinor: 0 }, NOW)).toBeNull();
  });

  it("builds an area card, with no type, for a type the gate does not price", () => {
    const card = cardFromAreaRow(PLACE, { ...ROW, propertyType: "land" as never });
    expect(card.scope).toBe("area");
    expect("propertyType" in card).toBe(false);
    expect("bedrooms" in card).toBe(false);
  });

  it("builds the answered card from the query and the gate's range", () => {
    const card = cardFromAnswer(
      { ...PLACE, lgaCode: "la_yaba", propertyType: "apartment", bedrooms: 2 },
      { lowMinor: 1.4, midMinor: 2.6, highMinor: 3, comparableCount: 9 },
    );
    expect(card).toEqual({
      scope: "area_and_type",
      stateCode: "LA",
      lgaCode: "la_yaba",
      area: "Yaba",
      propertyType: "apartment",
      listingIntent: "rent",
      bedrooms: 2,
      lowMinor: 1,
      midMinor: 3,
      highMinor: 3,
      listingCount: 9,
    });
  });
});
