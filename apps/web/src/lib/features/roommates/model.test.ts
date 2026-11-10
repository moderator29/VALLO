import { describe, expect, it } from "vitest";

import {
  EMPTY_LISTING,
  EMPTY_PEOPLE_FILTERS,
  EMPTY_PROFILE,
  EMPTY_ROOM_FILTERS,
  completenessPercent,
  canPublishProfile,
  filtersQuery,
  listingProblems,
  monthlyMinor,
  moveInCost,
  profileGaps,
  readPeopleFilters,
  readRoomFilters,
  roommatePhotoUrl,
  splitCosts,
  yearlyMinor,
  type SplitLine,
} from "./model";

/** The address a filter set writes, read back the way a page reads `searchParams`. */
function params(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query.replace(/^\?/, "")));
}

describe("money", () => {
  it("turns a yearly amount into a monthly one and leaves a monthly one alone", () => {
    expect(monthlyMinor(1_200_000_00, "year")).toBe(100_000_00);
    expect(monthlyMinor(100_000_00, "month")).toBe(100_000_00);
    expect(monthlyMinor(1_000_00, "year")).toBe(Math.round(1_000_00 / 12));
    expect(monthlyMinor(null, "year")).toBeNull();
    expect(monthlyMinor(Number.NaN, "month")).toBeNull();
    expect(yearlyMinor(100_000_00, "month")).toBe(1_200_000_00);
    expect(yearlyMinor(null, "month")).toBeNull();
  });

  it("adds a move-in total from the lister's own figures, preferring the person's share", () => {
    const cost = moveInCost({
      rentMinor: 1_200_000_00,
      shareMinor: 400_000_00,
      depositMinor: 100_000_00,
      agencyFeeMinor: 50_000_00,
      legalFeeMinor: null,
      serviceChargeMinor: 20_000_00,
    });
    expect(cost).toEqual({
      rentMinor: 400_000_00,
      depositMinor: 100_000_00,
      agencyMinor: 50_000_00,
      legalMinor: 0,
      serviceMinor: 20_000_00,
      totalMinor: 570_000_00,
    });
    expect(moveInCost({ rentMinor: 300_000_00, shareMinor: null, depositMinor: null, agencyFeeMinor: null, legalFeeMinor: null, serviceChargeMinor: null })?.totalMinor).toBe(300_000_00);
  });

  it("gives no move-in total when there is no rent, rather than a guess", () => {
    expect(moveInCost({ rentMinor: null, shareMinor: null, depositMinor: 10_00, agencyFeeMinor: null, legalFeeMinor: null, serviceChargeMinor: null })).toBeNull();
  });
});

describe("the cost splitter", () => {
  const lines: SplitLine[] = [
    { key: "rent", label: "Rent", amountMinor: 1_000_000_01, period: "year" },
    { key: "deposit", label: "Deposit", amountMinor: 200_000_00, period: "once" },
    { key: "agency", label: "Agency", amountMinor: 33_333_33, period: "once" },
    { key: "power", label: "Power", amountMinor: 25_000_00, period: "month" },
  ];

  it("splits so the shares always add up to the totals exactly, for every head count", () => {
    for (let people = 1; people <= 8; people += 1) {
      const r = splitCosts(lines, Array.from({ length: people }, () => 1));
      expect(r.people).toBe(people);
      expect(r.shares).toHaveLength(people);
      expect(r.shares.reduce((a, s) => a + s.upfrontMinor, 0)).toBe(r.upfrontTotalMinor);
      expect(r.shares.reduce((a, s) => a + s.monthlyMinor, 0)).toBe(r.monthlyTotalMinor);
    }
  });

  it("puts one-off lines and the first period of a recurring line in the move-in amount", () => {
    const r = splitCosts(lines, [1]);
    expect(r.upfrontTotalMinor).toBe(1_000_000_01 + 200_000_00 + 33_333_33 + 25_000_00);
    expect(r.monthlyTotalMinor).toBe(Math.round(1_000_000_01 / 12) + 25_000_00);
  });

  it("splits equally with equal weights, the remainder going to the first person", () => {
    const r = splitCosts([{ key: "x", label: "x", amountMinor: 100, period: "once" }], [1, 1, 1]);
    expect(r.shares.map((s) => s.upfrontMinor)).toEqual([34, 33, 33]);
  });

  it("lets a bigger room pay more, and still sums exactly", () => {
    const r = splitCosts([{ key: "rent", label: "Rent", amountMinor: 900_000_00, period: "year" }], [2, 1]);
    expect(r.shares[0]!.upfrontMinor).toBe(600_000_00);
    expect(r.shares[1]!.upfrontMinor).toBe(300_000_00);
    expect(r.shares[0]!.monthlyMinor + r.shares[1]!.monthlyMinor).toBe(r.monthlyTotalMinor);
  });

  it("treats an empty weight list as one person and ignores negative or broken amounts", () => {
    const r = splitCosts([{ key: "x", label: "x", amountMinor: -50, period: "once" }, { key: "y", label: "y", amountMinor: Number.NaN, period: "month" }], []);
    expect(r.people).toBe(1);
    expect(r.upfrontTotalMinor).toBe(0);
    expect(r.monthlyTotalMinor).toBe(0);
  });
});

describe("profile completeness", () => {
  const full = {
    ...EMPTY_PROFILE,
    intents: ["find_roommate" as const],
    city: "Lagos",
    budgetMaxMinor: 600_000_00,
    lifeStage: "student" as const,
    intro: "Final year student, quiet on weekdays, cooks most evenings.",
    lifestyle: { ...EMPTY_PROFILE.lifestyle, cleanliness: 3 as const, social: 1 as const, sleep: "early" as const, smoking: "never" as const },
  };

  it("names every gap of an empty profile, in the editor's order", () => {
    expect(profileGaps(EMPTY_PROFILE, false)).toEqual(["intents", "location", "budget", "about", "lifestyle", "photo"]);
    expect(completenessPercent(EMPTY_PROFILE, false)).toBe(Math.round((1 / 7) * 100));
  });

  it("asks for a move-in date only when the member said it is fixed", () => {
    expect(profileGaps({ ...full, moveInFlex: "fixed", moveInOn: null }, true)).toEqual(["move_in"]);
    expect(profileGaps({ ...full, moveInFlex: "flexible", moveInOn: null }, true)).toEqual([]);
  });

  it("reads a complete profile as complete and publishable", () => {
    expect(profileGaps(full, true)).toEqual([]);
    expect(completenessPercent(full, true)).toBe(100);
    expect(canPublishProfile(full)).toBe(true);
    expect(canPublishProfile({ ...full, city: "  " })).toBe(false);
  });
});

describe("listing problems", () => {
  it("asks a room offer for a title, a city, the rent, the lister's standing and the declaration", () => {
    expect(listingProblems(EMPTY_LISTING)).toEqual(["title", "city", "rent", "authority", "declared", "photos"]);
  });

  it("asks a roommate-wanted post only for a title and a city", () => {
    expect(listingProblems({ ...EMPTY_LISTING, kind: "roommate_wanted" })).toEqual(["title", "city"]);
    expect(listingProblems({ ...EMPTY_LISTING, kind: "together", title: "Two friends near UNILAG", city: "Lagos" })).toEqual([]);
  });

  it("has nothing to say about a complete room offer", () => {
    expect(
      listingProblems({ ...EMPTY_LISTING, title: "Ensuite room in Yaba", city: "Lagos", rentMinor: 700_000_00, authority: "tenant_permitted", declared: true, photos: ["u/1.jpg", "u/2.jpg", "u/3.jpg"] }),
    ).toEqual([]);
  });
});

describe("filters in the address", () => {
  const school = "7d9c2b1a-3e4f-4a5b-8c6d-1e2f3a4b5c6d";

  it("reads nothing as the empty filters", () => {
    expect(readPeopleFilters({})).toEqual(EMPTY_PEOPLE_FILTERS);
    expect(readRoomFilters({})).toEqual(EMPTY_ROOM_FILTERS);
    expect(filtersQuery({})).toBe("");
  });

  it("round-trips people filters through the address", () => {
    const f = { ...EMPTY_PEOPLE_FILTERS, q: "yaba", stateCode: "LA", city: "Lagos", institutionId: school, maxMinor: 500_000_00, period: "month" as const, moveBy: "2027-01-15", lifeStage: "corps_member" as const, intent: "find_room" as const, verifiedOnly: true, sort: "budget" as const };
    expect(readPeopleFilters(params(filtersQuery(f)))).toEqual(f);
  });

  it("round-trips room filters, with the mode alongside", () => {
    const f = { ...EMPTY_ROOM_FILTERS, city: "Ibadan", kind: "room_offer" as const, roomType: "ensuite" as const, furnished: "semi" as const, genderPref: "female" as const, maxMinor: 300_000_00 };
    const query = filtersQuery({ ...f, mode: "rooms" });
    expect(params(query).mode).toBe("rooms");
    expect(readRoomFilters(params(query))).toEqual(f);
  });

  it("drops what it cannot trust: a bad school id, a bad date, an unknown choice, a non-positive amount", () => {
    const f = readPeopleFilters({ school: "not-a-uuid", by: "15/01/2027", who: "astronaut", max: "-4", per: "week", state: "lagos" });
    expect(f.institutionId).toBeNull();
    expect(f.moveBy).toBeNull();
    expect(f.lifeStage).toBeNull();
    expect(f.maxMinor).toBeNull();
    expect(f.period).toBe("year");
    expect(f.stateCode).toBe("LA");
  });

  it("leaves defaults out of the address", () => {
    expect(filtersQuery({ period: "year", sort: "match" })).toBe("");
    expect(filtersQuery({ sort: "newest" })).toBe("");
  });
});

describe("photo addresses", () => {
  it("serves a bare path from the roommate bucket, a linked property's from the listing bucket, and passes full URLs through", () => {
    expect(roommatePhotoUrl("https://x.supabase.co/", "u1/a b.jpg")).toBe("https://x.supabase.co/storage/v1/object/public/roommate-photos/u1/a%20b.jpg");
    expect(roommatePhotoUrl("https://x.supabase.co", "listing-photos/l1/p.jpg")).toBe("https://x.supabase.co/storage/v1/object/public/listing-photos/l1/p.jpg");
    expect(roommatePhotoUrl("https://x.supabase.co", "https://cdn.example/p.jpg")).toBe("https://cdn.example/p.jpg");
  });
});
