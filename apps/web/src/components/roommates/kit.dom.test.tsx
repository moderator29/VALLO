import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";

import { EMPTY_LIFESTYLE, type RoomCard, type RoommateCard } from "@/lib/features/roommates/model";

import { RoomCardView, RoommateCardView } from "./Cards";
import { CostBreakdown, MatchPanel } from "./Panels";

/**
 * The kit's cards and panels, rendered: one labelled link per card, what was
 * checked named in words, a number only where one was worked out, and money
 * from the lister's own figures. Every person and room here is invented.
 */
const t = getDictionary("en").roommates;

const PERSON: RoommateCard = {
  userId: "11111111-1111-4111-8111-111111111111",
  name: "Test Person",
  handle: null,
  avatarUrl: null,
  intro: "Final year student, quiet evenings.",
  lifeStage: "student",
  institution: { id: "22222222-2222-4222-8222-222222222222", slug: "test-school", name: "Test School", shortName: "TS", kind: "university", stateCode: "LA", city: "Lagos" },
  workplace: null,
  stateCode: "LA",
  city: "Lagos",
  areas: ["Yaba"],
  budget: { minMinor: null, maxMinor: 60_000_000, period: "year" },
  moveInOn: null,
  moveInFlex: "asap",
  intents: ["find_roommate"],
  roomPref: "private",
  lifestyle: { ...EMPTY_LIFESTYLE, smoking: "never", cleanliness: 3 },
  gender: null,
  badges: ["student_email"],
  lastActiveAt: "2026-11-07T10:00:00Z",
  match: { score: 86, parts: { budget: 0.9, location: 1 }, reasons: ["budget", "same_area"] },
};

const ROOM: RoomCard = {
  id: "33333333-3333-4333-8333-333333333333",
  kind: "room_offer",
  status: "live",
  title: "Ensuite room in a quiet flat",
  stateCode: "LA",
  city: "Lagos",
  area: "Yaba",
  institution: null,
  rentMinor: 120_000_000,
  rentPeriod: "year",
  shareMinor: 60_000_000,
  roomsAvailable: 1,
  occupantsNow: 1,
  occupantsMax: 2,
  bedrooms: 2,
  bathrooms: 2,
  roomType: "ensuite",
  furnished: "semi",
  amenities: ["wifi", "power_backup", "water"],
  availableFrom: "2026-11-01",
  genderPref: "any",
  photoUrls: [],
  verified: false,
  linkedListingId: null,
  owner: { userId: "44444444-4444-4444-8444-444444444444", name: "Lister Name", handle: null, avatarUrl: null, badges: [] },
  publishedAt: "2026-11-01T10:00:00Z",
  match: null,
};

describe("RoommateCardView", () => {
  it("is one link to the profile, named by the person", () => {
    const html = renderToStaticMarkup(<RoommateCardView card={PERSON} t={t} />);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain(`href="/roommates/p/${PERSON.userId}"`);
    expect(html).toContain("Test Person");
  });

  it("names what was checked, and the match with its reasons", () => {
    const html = renderToStaticMarkup(<RoommateCardView card={PERSON} t={t} />);
    expect(html).toContain(t.verification.kinds.student_email);
    expect(html).toContain('aria-label="86% compatible"');
    expect(html).toContain(t.reasons.budget);
    expect(html).toContain("Non-smoker");
  });

  it("draws no number when the match could not be worked out", () => {
    const html = renderToStaticMarkup(<RoommateCardView card={{ ...PERSON, match: { score: null, parts: {}, reasons: [] } }} t={t} />);
    expect(html).toContain(t.match.thin);
    expect(html).not.toMatch(/\d+% compatible/);
  });
});

describe("RoomCardView", () => {
  it("draws a calm tile, never a stand-in photograph, when there are no photos", () => {
    const html = renderToStaticMarkup(<RoomCardView room={ROOM} t={t} today="2026-11-08" />);
    expect(html).toContain(t.ui.card.noPhoto);
    expect(html).not.toContain("<img");
  });

  it("shows the verified chip only when Vallo checked the post", () => {
    expect(renderToStaticMarkup(<RoomCardView room={ROOM} t={t} />)).not.toContain(t.ui.card.verified);
    expect(renderToStaticMarkup(<RoomCardView room={{ ...ROOM, verified: true }} t={t} />)).toContain(t.ui.card.verified);
  });

  it("prices the share when one is given and says so", () => {
    const html = renderToStaticMarkup(<RoomCardView room={ROOM} t={t} />);
    expect(html).toContain(t.ui.card.shareLabel);
    expect(html).toContain("/year");
    expect(html).toContain(t.listingKinds.room_offer);
  });

  it("is not a link on the post flow's review", () => {
    const html = renderToStaticMarkup(<RoomCardView room={ROOM} t={t} linked={false} />);
    expect(html).not.toContain("<a ");
  });
});

describe("MatchPanel", () => {
  it("draws a bar only for the parts that were compared, and the honest line", () => {
    const html = renderToStaticMarkup(<MatchPanel match={PERSON.match} t={t} />);
    expect(html).toContain(t.match.parts.budget);
    expect(html).toContain(t.match.parts.location);
    expect(html).not.toContain(t.match.parts.lifestyle);
    expect(html).toContain(t.match.honest);
  });

  it("asks for more profile rather than showing a number it does not have", () => {
    const html = renderToStaticMarkup(<MatchPanel match={{ score: null, parts: {}, reasons: [] }} t={t} />);
    expect(html).toContain(t.match.thin);
    expect(html).not.toContain("nf-rm-bar__fill");
  });
});

describe("CostBreakdown", () => {
  const cost = {
    kind: "room_offer" as const,
    rentMinor: 120_000_000,
    rentPeriod: "year" as const,
    shareMinor: 60_000_000,
    depositMinor: 10_000_000,
    agencyFeeMinor: 5_000_000,
    legalFeeMinor: null,
    serviceChargeMinor: 2_000_000,
    utilitiesMonthlyMinor: 1_500_000,
  };

  it("totals one person's move-in from the lister's figures", () => {
    const html = renderToStaticMarkup(<CostBreakdown cost={cost} t={t} />);
    expect(html).toContain(t.listing.yourShare);
    expect(html).toContain(t.listing.moveInTotal);
    /* 600,000 + 100,000 + 50,000 + 20,000 */
    expect(html).toContain("770,000");
    expect(html).not.toContain(t.listing.legal);
    expect(html).toContain(t.listing.costNote);
  });

  it("says the costs are missing rather than inventing any", () => {
    const html = renderToStaticMarkup(<CostBreakdown cost={{ ...cost, rentMinor: null, shareMinor: null }} t={t} />);
    expect(html).toContain(t.ui.listing.noCosts);
    expect(html).not.toContain(t.listing.moveInTotal);
  });
});
