import { describe, expect, it } from "vitest";
import { cleanQuery, foldKey, hasLongDigitRun } from "./text";
import { closestWord, editDistance, trigramSimilarity } from "./fuzzy";
import { findPlace, placeLabel } from "./places";
import { addDays, queryFromUnderstood, spellingFix, thisWeekend, understand, withoutFilter } from "./understand";

/* Monday 16 November 2026, 11:00 in Lagos. */
const NOW = new Date("2026-11-16T10:00:00Z");
const read = (q: string) => understand(q, { now: NOW });

describe("the founder's fifteen queries", () => {
  it("2 bedroom apartment in Lekki", () => {
    const { understood } = read("2 bedroom apartment in Lekki");
    expect(understood).toMatchObject({ kind: "property", bedrooms: 2, place: "Lekki, Lagos", via: "rules" });
    expect(understood.text).toBeUndefined();
    expect(understood.didYouMean).toBeUndefined();
  });

  it("apartments in Lagos", () => {
    expect(read("apartments in Lagos").understood).toMatchObject({ kind: "property", place: "Lagos" });
  });

  it("cheap flat near Yaba: cheap orders by price and never invents a budget", () => {
    const { understood, hints } = read("cheap flat near Yaba");
    expect(understood).toMatchObject({ kind: "property", place: "Yaba, Lagos" });
    expect(understood.maxPrice).toBeUndefined();
    expect(hints.cheap).toBe(true);
  });

  it("hotels in Abuja", () => {
    expect(read("hotels in Abuja").understood).toMatchObject({ kind: "stay", intent: "stay", listingKinds: ["hotel"], place: "Abuja" });
  });

  it("resturants in VI: the alias is read, the spelling is offered and not applied", () => {
    const { understood } = read("resturants in VI");
    expect(understood.raw).toBe("resturants in VI");
    expect(understood.place).toBe("Victoria Island, Lagos");
    expect(understood.didYouMean).toBe("restaurants in Victoria Island");
    expect(understood.kind).toBeUndefined();
    expect(read(understood.didYouMean!).understood).toMatchObject({ kind: "restaurant", place: "Victoria Island, Lagos" });
  });

  it("furnished shortlet in Lekki", () => {
    expect(read("furnished shortlet in Lekki").understood).toMatchObject({ kind: "stay", listingKinds: ["shortlet"], furnished: true, place: "Lekki, Lagos" });
  });

  it("room mate in Lagos", () => {
    expect(read("room mate in Lagos").understood).toMatchObject({ kind: "roommate", place: "Lagos" });
  });

  it("property for sale", () => {
    expect(read("property for sale").understood).toMatchObject({ kind: "property", intent: "buy" });
  });

  it("houses with swimming pool", () => {
    expect(read("houses with swimming pool").understood).toMatchObject({ kind: "property", amenities: ["pool"] });
  });

  it("make an ofer: offered as make an offer, which is the offer how-to", () => {
    const { understood } = read("make an ofer");
    expect(understood.didYouMean).toBe("make an offer");
    expect(read("make an offer").understood.kind).toBe("guide");
  });

  it("find my saved properties", () => {
    const { understood, hints } = read("find my saved properties");
    expect(understood.kind).toBe("personal");
    expect(hints.personal).toEqual(["saved"]);
  });

  it("show my previous offers", () => {
    const { understood, hints } = read("show my previous offers");
    expect(understood.kind).toBe("personal");
    expect(hints.personal).toEqual(["offers"]);
  });

  it("how to list a property", () => {
    const { understood, hints } = read("how to list a property");
    expect(understood.kind).toBe("guide");
    expect(hints.question).toBe(true);
  });

  it("find a restaurant for dinner", () => {
    const { understood } = read("find a restaurant for dinner");
    expect(understood.kind).toBe("restaurant");
    expect(understood.text).toBeUndefined();
  });

  it("a misspelled listing title is offered with the place spelled right", () => {
    const { understood } = read("Banana Iland duplex");
    expect(understood.didYouMean).toBe("Banana Island duplex");
    expect(read(understood.didYouMean!).understood).toMatchObject({ place: "Banana Island, Lagos", text: "duplex", kind: "property" });
  });
});

describe("spelling", () => {
  it.each([
    ["appartments in lekki", "apartments in Lekki"],
    ["hotle in vi", "hotel in Victoria Island"],
    ["accomodation in abuja", "accommodation in Abuja"],
    ["roomate in yaba", "roommate in Yaba"],
    ["surelere flats", "surulere flats"],
  ])("%s -> %s", (typed, offered) => {
    expect(read(typed).understood.didYouMean?.toLowerCase()).toBe(offered.toLowerCase());
  });

  it("never offers a fix for words it knows or for short words", () => {
    expect(spellingFix("show me a shop in yaba")).toBeNull();
    expect(read("2 bedroom flat in ikeja").understood.didYouMean).toBeUndefined();
    expect(closestWord("show", ["shop"])).toBeNull();
  });

  it("measures like pg_trgm and counts a swap as one edit", () => {
    expect(trigramSimilarity("lekki", "lekki")).toBe(1);
    expect(trigramSimilarity("word", "")).toBe(0);
    expect(editDistance("hotle", "hotel")).toBe(1);
    expect(editDistance("resturants", "restaurants")).toBe(1);
  });
});

describe("places", () => {
  it.each([
    ["flats in VI", "Victoria Island, Lagos"],
    ["V.I. hotels", "Victoria Island, Lagos"],
    ["lekki phase 1 duplex", "Lekki Phase 1, Lagos"],
    ["lekki phase one duplex", "Lekki Phase 1, Lagos"],
    ["lekki phase on", "Lekki Phase 1, Lagos"],
    ["ikoyi", "Ikoyi, Lagos"],
    ["yaba", "Yaba, Lagos"],
    ["wuse 2 shortlet", "Wuse 2, Abuja"],
    ["maitama", "Maitama, Abuja"],
    ["gwarinpa", "Gwarinpa, Abuja"],
    ["shops in PH", "Port Harcourt"],
    ["hotels in fct", "Abuja"],
    ["Ikeja GRA", "Ikeja GRA, Lagos"],
    ["bodija", "Bodija, Ibadan"],
  ])("%s is %s", (q, label) => {
    expect(read(q).understood.place).toBe(label);
  });

  it("a place alone is a place search", () => {
    expect(read("Ikoyi").understood.kind).toBe("place");
  });

  it("an unknown place stays as words, never guessed", () => {
    const { understood } = read("flats in Atlantis");
    expect(understood.place).toBeUndefined();
    expect(understood.text).toBe("atlantis");
  });

  it("longest name first", () => {
    const hit = findPlace("2 bed lekki phase 1");
    expect(hit && placeLabel(hit.place)).toBe("Lekki Phase 1, Lagos");
  });

  it("staff place aliases may only point at a place on the list", () => {
    expect(understand("flats in lekki 1", { now: NOW, aliases: { places: { "lekki 1": "Lekki Phase 1" } } }).understood.place).toBe("Lekki Phase 1, Lagos");
    expect(findPlace("flats in moon", { moon: "The Moon" })).toBeNull();
  });

  it("staff word aliases are read", () => {
    expect(understand("buka in yaba", { now: NOW, aliases: { words: { buka: "restaurant" } } }).understood.kind).toBe("restaurant");
  });
});

describe("money and rooms", () => {
  it.each([
    ["flat under 5m", { maxPrice: 5_000_000 }],
    ["flat ₦5,000,000", { maxPrice: 5_000_000 }],
    ["flat 5 million", { maxPrice: 5_000_000 }],
    ["self contain 500k", { maxPrice: 500_000 }],
    ["above 2m duplex", { minPrice: 2_000_000 }],
    ["2m to 3m flat", { minPrice: 2_000_000, maxPrice: 3_000_000 }],
    ["2bedroom flat", { bedrooms: 2 }],
    ["three bedroom house", { bedrooms: 3 }],
  ])("%s", (q, expected) => {
    expect(read(q).understood).toMatchObject(expected);
  });

  it("a bare number is not money (it could be a house number)", () => {
    const { understood } = read("flat 2000000 yaba");
    expect(understood.maxPrice).toBeUndefined();
  });
});

describe("dates, guests and newness on the Lagos calendar", () => {
  it("this weekend from a Monday is Friday to Sunday", () => {
    expect(thisWeekend("2026-11-16")).toEqual({ checkIn: "2026-11-20", checkOut: "2026-11-22" });
    expect(thisWeekend("2026-11-21")).toEqual({ checkIn: "2026-11-21", checkOut: "2026-11-22" });
  });

  it("shortlet this weekend for 2 guests", () => {
    expect(read("shortlet this weekend for 2 guests").understood).toMatchObject({ kind: "stay", checkIn: "2026-11-20", checkOut: "2026-11-22", guests: 2 });
  });

  it("tomorrow, tonight and nights", () => {
    expect(read("hotel tomorrow").understood).toMatchObject({ checkIn: "2026-11-17", checkOut: "2026-11-18" });
    expect(read("hotel tonight for 3 nights").understood).toMatchObject({ checkIn: "2026-11-16", checkOut: "2026-11-19" });
  });

  it("the Lagos day is used near midnight UTC", () => {
    /* 23:30 UTC on the 16th is 00:30 on the 17th in Lagos. */
    expect(understand("hotel today", { now: new Date("2026-11-16T23:30:00Z") }).understood.checkIn).toBe("2026-11-17");
  });

  it("dates and guests alone point at stays", () => {
    expect(read("somewhere for 4 guests tomorrow").understood.kind).toBe("stay");
  });

  it("new this week sets addedSince", () => {
    expect(read("new this week in ikoyi").understood.addedSince).toBe(addDays("2026-11-16", -7));
  });

  it("furnished and unfurnished", () => {
    expect(read("unfurnished flat").understood.furnished).toBe(false);
    expect(read("semi furnished flat").understood.furnished).toBe(true);
  });

  it("amenities only from codes the schema holds", () => {
    expect(read("apartment with gym wifi and parking").understood.amenities?.sort()).toEqual(["gym", "parking", "wifi"]);
    expect(read("apartment with helipad").understood.amenities).toBeUndefined();
  });
});

describe("cleaning", () => {
  it("strips control characters, collapses space and caps at 120", () => {
    expect(cleanQuery("  flats\u0000 in​  yaba ")).toBe("flats in yaba");
    expect(cleanQuery("x".repeat(500)).length).toBe(120);
    expect(cleanQuery(42)).toBe("");
  });

  it("folds accents and dots", () => {
    expect(foldKey("Ikoyí V.I.")).toBe("ikoyi vi.");
  });

  it("finds phone and account numbers", () => {
    expect(hasLongDigitRun("call 0803 123 4567")).toBe(true);
    expect(hasLongDigitRun("₦5,000,000 flat")).toBe(false);
  });
});

describe("back to words", () => {
  it("an alternative reads back to the same filters", () => {
    const u = read("2 bedroom apartment in Lekki under 5m").understood;
    const q = queryFromUnderstood(withoutFilter(u, "maxPrice"));
    expect(read(q).understood).toMatchObject({ kind: "property", bedrooms: 2, place: "Lekki, Lagos" });
    expect(read(q).understood.maxPrice).toBeUndefined();
  });
});
