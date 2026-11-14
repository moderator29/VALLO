import { describe, expect, it } from "vitest";
import { agentStatItems, compactCount, conversionPercent, countPhrase, daysLive, listingStatItems, timeOnVallo } from "./format";
import { listingStatsEn } from "@vallo/i18n/en/listing-stats";

const NOW = new Date("2026-11-13T10:00:00+01:00");
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe("compact figures", () => {
  it("writes small counts in full and large ones compact, never rounding up", () => {
    expect(compactCount(0)).toBe("0");
    expect(compactCount(999)).toBe("999");
    expect(compactCount(1000)).toBe("1k");
    expect(compactCount(1234)).toBe("1.2k");
    expect(compactCount(1999)).toBe("1.9k");
    expect(compactCount(12_480)).toBe("12.4k");
    expect(compactCount(123_456)).toBe("123k");
    expect(compactCount(999_999)).toBe("999k");
    expect(compactCount(1_250_000)).toBe("1.2m");
    expect(compactCount(-3)).toBe("0");
    expect(compactCount(Number.NaN)).toBe("0");
  });

  it("pluralises on the real count and keeps the whole number for a screen reader", () => {
    expect(countPhrase(1, listingStatsEn.views)).toEqual({ text: "1 view", full: "1 view" });
    expect(countPhrase(0, listingStatsEn.saves)).toEqual({ text: "0 saves", full: "0 saves" });
    expect(countPhrase(1234, listingStatsEn.views)).toEqual({ text: "1.2k views", full: "1,234 views" });
  });
});

describe("time on Vallo", () => {
  it("is Listed today on day 0, days to 60, months after, years from 24 months", () => {
    expect(timeOnVallo(0)).toBe("Listed today");
    expect(timeOnVallo(1)).toBe("1 day on Vallo");
    expect(timeOnVallo(12)).toBe("12 days on Vallo");
    expect(timeOnVallo(60)).toBe("60 days on Vallo");
    expect(timeOnVallo(61)).toBe("2 months on Vallo");
    expect(timeOnVallo(130)).toBe("4 months on Vallo");
    expect(timeOnVallo(700)).toBe("22 months on Vallo");
    expect(timeOnVallo(740)).toBe("2 years on Vallo");
  });

  it("counts Lagos days and has no answer for a missing or future date", () => {
    expect(daysLive(null, NOW)).toBeNull();
    expect(daysLive("not a date", NOW)).toBeNull();
    expect(daysLive(new Date(NOW.getTime() + 3_600_000).toISOString(), NOW)).toBeNull();
    /* 00:30 in Lagos is already the 13th there, though it is the 12th in UTC. */
    expect(daysLive("2026-11-12T23:30:00Z", NOW)).toBe(0);
    /* 23:30 in Lagos on the 12th is one day, an hour before midnight. */
    expect(daysLive("2026-11-12T22:30:00Z", new Date("2026-11-13T00:30:00+01:00"))).toBe(1);
    expect(daysLive(ago(12), NOW)).toBe(12);
  });
});

describe("which items a listing shows", () => {
  it("gives an example its counts but never a time on Vallo", () => {
    expect(listingStatItems({ isDemo: true, publishedAt: ago(3), figures: { views: 50, saves: 2, shares: 4 }, now: NOW })?.map((i) => i.text)).toEqual([
      "50 views",
      "2 saves",
      "4 shares",
    ]);
  });

  it("shows shares from the first one, and never before the database knows them", () => {
    const texts = (shares?: number) =>
      listingStatItems({ isDemo: false, publishedAt: ago(3), figures: { views: 5, saves: 1, ...(shares === undefined ? {} : { shares }) }, now: NOW })?.map((i) => i.key);
    expect(texts()).toEqual(["days", "views", "saves"]);
    expect(texts(0)).toEqual(["days", "views", "saves"]);
    expect(texts(1)).toEqual(["days", "views", "saves", "shares"]);
  });

  it("fails closed: no figures (SQL not applied, read failed) means no row, not even the age", () => {
    expect(listingStatItems({ isDemo: false, publishedAt: ago(3), figures: null, now: NOW })).toBeNull();
  });

  it("shows views from the first one, and saves at zero", () => {
    const fresh = listingStatItems({ isDemo: false, publishedAt: ago(0), figures: { views: 0, saves: 0 }, now: NOW });
    expect(fresh?.map((i) => i.text)).toEqual(["Listed today", "0 saves"]);
    const live = listingStatItems({ isDemo: false, publishedAt: ago(12), figures: { views: 340, saves: 18 }, now: NOW });
    expect(live?.map((i) => i.text)).toEqual(["12 days on Vallo", "340 views", "18 saves"]);
    expect(live?.map((i) => i.key)).toEqual(["days", "views", "saves"]);
  });

  it("leaves the age out when the date is missing", () => {
    const items = listingStatItems({ isDemo: false, publishedAt: null, figures: { views: 2, saves: 1 }, now: NOW });
    expect(items?.map((i) => i.text)).toEqual(["2 views", "1 save"]);
  });

  it("gives the lister their own words, including no views yet", () => {
    expect(agentStatItems({ publishedAt: ago(0), figures: { views: 0, saves: 0 }, now: NOW })?.map((i) => i.text)).toEqual([
      "Live today",
      "No views yet",
      "0 saves",
    ]);
    expect(agentStatItems({ publishedAt: ago(9), figures: { views: 1500, saves: 3 }, now: NOW })?.map((i) => i.text)).toEqual([
      "9 days live",
      "1.5k views",
      "3 saves",
    ]);
    expect(agentStatItems({ publishedAt: ago(9), figures: null, now: NOW })).toBeNull();
  });
});

describe("conversion", () => {
  it("is a share of views to one decimal, and nothing without views", () => {
    expect(conversionPercent(9, 120)).toBe(7.5);
    expect(conversionPercent(1, 3)).toBe(33.3);
    expect(conversionPercent(4, 0)).toBeNull();
  });
});

describe("the card's counts", () => {
  it("shows only views on a card, never saves or shares, never a zero", async () => {
    const { cardStatItems } = await import("./format");
    expect(cardStatItems({ stats: null })).toBeNull();
    expect(cardStatItems({ stats: undefined })).toBeNull();
    expect(cardStatItems({ stats: { views: 0, saves: 0 } })).toBeNull();
    expect(cardStatItems({ stats: { views: 0, saves: 1 } })).toBeNull();
    expect(cardStatItems({ stats: { views: 1, saves: 0 } })?.map((i) => [i.key, i.text, i.full])).toEqual([["views", "1", "1 view"]]);
    expect(cardStatItems({ stats: { views: 1234, saves: 24 } })?.map((i) => [i.text, i.full])).toEqual([["1.2k", "1,234 views"]]);
    expect(cardStatItems({ stats: { views: 5, saves: 1, shares: 3 } })?.map((i) => i.key)).toEqual(["views"]);
  });
});

describe("the listing page's tiles", () => {
  it("draws views and saves always, shares once known, and nothing without figures", async () => {
    const { listingPulse } = await import("./format");
    expect(listingPulse({ figures: null })).toBeNull();
    expect(listingPulse({ figures: { views: 0, saves: 0 } })?.map((t) => [t.key, t.value, t.label])).toEqual([
      ["views", "0", "views"],
      ["saves", "0", "saves"],
    ]);
    expect(listingPulse({ figures: { views: 1, saves: 1, shares: 1 } })?.map((t) => [t.key, t.value, t.label, t.full])).toEqual([
      ["views", "1", "view", "1 view"],
      ["saves", "1", "save", "1 save"],
      ["shares", "1", "share", "1 share"],
    ]);
    /* Compact on the tile, whole for a screen reader, never rounded up. */
    expect(listingPulse({ figures: { views: 12_480, saves: 1_999, shares: 0 } })?.map((t) => [t.value, t.full])).toEqual([
      ["12.4k", "12,480 views"],
      ["1.9k", "1,999 saves"],
      ["0", "0 shares"],
    ]);
  });
});
