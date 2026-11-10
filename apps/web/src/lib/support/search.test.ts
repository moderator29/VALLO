import { describe, expect, it } from "vitest";
import { FAQS } from "./help-articles";
import { groupHitsByKind, markMatches, search, stem, queryTerms, type SearchEntry, type SearchHit } from "./search";

const E: SearchEntry[] = [
  { id: "1", section: "help", title: "Does it cost anything to list?", trail: "Listing your property", text: "Listing is free. Vallo only charges when a deal is completed.", href: "/help#a" },
  { id: "2", section: "docs", title: "Cancelling a booking", trail: "Docs, Booking and paying", text: "Open the booking in Plans and choose Cancel. The refund follows the cancellation schedule.", href: "/docs/booking-and-paying#cancelling" },
  { id: "3", section: "guides", title: "Avoiding rental scams", trail: "Guides", text: "Never pay outside Vallo.", href: "/guides/avoiding-rental-scams" },
  { id: "4", section: "legal", title: "Cancellations and refunds", trail: "Legal and safety", text: "The refund schedule for a paid stay.", href: "/cancellations" },
];

describe("unified search", () => {
  it("stems plurals and endings so cancel finds cancelling and cancelled", () => {
    expect(stem("cancelling")).toBe(stem("cancel"));
    expect(stem("cancelled")).toBe(stem("cancel"));
    expect(stem("bookings")).toBe(stem("booking"));
  });

  it("drops filler words from a plain question", () => {
    expect(queryTerms("how do I cancel a booking").map((t) => t.stem)).toEqual([stem("cancel"), stem("booking")]);
  });

  it("answers 'how do I cancel a booking' with the docs chapter first", () => {
    const hits = search(E, "how do I cancel a booking");
    expect(hits[0]?.entry.id).toBe("2");
  });

  it("answers 'is Vallo free' through the synonym for fee and charge", () => {
    const hits = search(E, "is Vallo free");
    expect(hits[0]?.entry.id).toBe("1");
  });

  it("returns the section each result came from", () => {
    const hits = search(E, "refund");
    expect(new Set(hits.map((h) => h.entry.section)).size).toBeGreaterThan(1);
  });

  it("finds nothing for an empty or filler-only query", () => {
    expect(search(E, "   ")).toEqual([]);
    expect(search(E, "how do I")).toEqual([]);
  });

  it("does not drag in everything for a nonsense word", () => {
    expect(search(E, "zzzqx")).toEqual([]);
  });
});

describe("results grouped by kind (R99)", () => {
  const hit = (id: string, section: SearchEntry["section"]): SearchHit => ({
    entry: { id, section, title: id, trail: "", text: "", href: "/" },
    score: 0,
    snippet: "",
    terms: [],
  });
  it("keeps the best match first and each kind in rank order", () => {
    const ranked = [hit("a", "docs"), hit("b", "help"), hit("c", "docs"), hit("d", "legal"), hit("e", "help")];
    expect(groupHitsByKind(ranked).map((h) => h.entry.id)).toEqual(["a", "c", "b", "e", "d"]);
  });
});

describe("the matched words, marked (R99)", () => {
  it("marks a plural or an ending of a matched term, and nothing else", () => {
    const parts = markMatches("Refunds go back to the card. A refund starts within days.", ["refund"]);
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(["Refunds", "refund"]);
    expect(parts.map((p) => p.text).join("")).toBe("Refunds go back to the card. A refund starts within days.");
  });

  it("never marks filler words, and leaves a snippet with no terms whole", () => {
    expect(markMatches("How do I pay", ["how", "pay"]).filter((p) => p.match).map((p) => p.text)).toEqual(["pay"]);
    expect(markMatches("Plain text", [])).toEqual([{ text: "Plain text", match: false }]);
    expect(markMatches("", ["pay"])).toEqual([]);
  });

  it("carries the hit's terms, so a result row can mark them", () => {
    const [hit] = search(E, "cancel");
    expect(hit?.terms).toContain("cancel");
  });
});

describe("the real help articles", () => {
  const entries: SearchEntry[] = FAQS.map((f, i) => ({
    id: `h${i}`,
    section: "help",
    title: f.q,
    trail: f.category,
    text: f.a,
    href: "/help",
  }));

  it("finds the refund answers for a plain question", () => {
    const hits = search(entries, "how do I get a refund");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.entry.title.toLowerCase()).toContain("refund");
  });

  it("finds fee answers for 'is Vallo free'", () => {
    expect(search(entries, "is Vallo free").length).toBeGreaterThan(0);
  });

  it("finds a cancel answer for 'how do I cancel a booking'", () => {
    expect(search(entries, "how do I cancel a booking").length).toBeGreaterThan(0);
  });
});
