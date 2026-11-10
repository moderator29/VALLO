import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";

import type { RoomDetail, RoommateProfileView } from "../roommates/model";
import { buildPersonCard, buildRoomCard, cardHref, looksLikeContact, postTitleFor, readCard, CARD_KEYS } from "./roommate-card";

const t = getDictionary("en").roommates;
const ID = "0b9f6d3e-1d6f-4f0e-9a52-6f8a5c1d2e33";
const OTHER = "7c1a9b50-3e2d-4b44-8f10-aa21c3d4e5f6";

const room = {
  id: ID,
  kind: "roommate_wanted",
  status: "live",
  title: "Room near Unilag gate",
  stateCode: "LA",
  city: "Lagos",
  area: "Akoka",
  rentMinor: 150_000_00,
  rentPeriod: "year",
  shareMinor: null,
  description: "Call me on 08031234567 or write to ada@example.com",
  houseRules: ["No parties"],
  owner: { userId: OTHER, name: "Ada Obi", handle: "ada", avatarUrl: "https://x/y.jpg", badges: [] },
  photoUrls: ["https://x/p.jpg"],
  depositMinor: 5_000_000,
} as unknown as RoomDetail;

const person = {
  userId: OTHER,
  name: "Ada Obi",
  handle: "ada",
  avatarUrl: "https://x/y.jpg",
  intro: "Reach me at ada@example.com",
  lifeStage: "student",
  institution: { id: "i", slug: "unilag", name: "University of Lagos", shortName: "UNILAG", kind: "university", stateCode: "LA", city: "Lagos" },
  workplace: "Some Bank",
  stateCode: "LA",
  city: "Lagos",
  areas: ["Akoka", "Yaba", "Surulere"],
  budget: { minMinor: 1, maxMinor: 2, period: "year" },
  intents: ["find_room", "find_roommate", "find_together"],
  gender: "female",
  course: "Law",
  studyLevel: "300",
  badges: ["identity"],
} as unknown as RoommateProfileView;

describe("a Roommates card on a Circle post: only what the page already shows", () => {
  it("a room card holds the title, the place, the kind and the price, and nothing from the description, owner or photos", () => {
    const card = buildRoomCard(room, t);
    expect(Object.keys(card).sort()).toEqual([...CARD_KEYS].sort());
    expect(card).toMatchObject({ v: 1, kind: "room", ref: ID, title: "Room near Unilag gate", place: "Akoka, Lagos" });
    expect(card.summary).toContain("Roommate wanted");
    expect(card.summary).toContain("150,000");
    const flat = JSON.stringify(card);
    for (const secret of ["08031234567", "ada@example.com", "Ada Obi", "ada", "x/y.jpg", "p.jpg", "No parties", "5,000,000", "5000000"]) expect(flat).not.toContain(secret);
  });

  it("a person card holds the FIRST NAME only, school and area, and what they are here for", () => {
    const card = buildPersonCard(person, t);
    expect(Object.keys(card).sort()).toEqual([...CARD_KEYS].sort());
    expect(card.title).toBe("Ada");
    expect(card.ref).toBe(OTHER);
    expect(card.place).toContain("UNILAG");
    expect(card.place).toContain("Akoka");
    expect(card.summary).toBe(`${t.intents.find_room} · ${t.intents.find_roommate}`);
    const flat = JSON.stringify(card);
    for (const secret of ["Obi", "@", "Some Bank", "female", "Law", "300", "https", "handle"]) expect(flat).not.toContain(secret);
    expect(flat).not.toMatch(/\d{5,}/);
  });

  it("every card it builds passes the strict reader, and the link is the real page built from the id", () => {
    for (const card of [buildRoomCard(room, t), buildPersonCard(person, t)]) {
      expect(readCard(card)).toEqual(card);
    }
    expect(cardHref({ kind: "room", ref: ID })).toBe(`/roommates/r/${ID}`);
    expect(cardHref({ kind: "person", ref: OTHER })).toBe(`/roommates/p/${OTHER}`);
  });

  it("the post title: a room's own title, a person as 'Ada on Vallo Roommates'", () => {
    expect(postTitleFor(buildRoomCard(room, t), t)).toBe("Room near Unilag gate");
    expect(postTitleFor(buildPersonCard(person, t), t)).toBe("Ada on Vallo Roommates");
  });
});

describe("reading a stored card back is strict", () => {
  const good = { v: 1, kind: "room", ref: ID, title: "A room", place: "Yaba", summary: "Room available" };
  it("accepts the closed shape", () => expect(readCard(good)).toEqual(good));
  it("refuses an extra key, a wrong version or kind, a bad id, an empty title, and non-objects", () => {
    expect(readCard({ ...good, phone: "1" })).toBeNull();
    expect(readCard({ ...good, v: 2 })).toBeNull();
    expect(readCard({ ...good, kind: "listing" })).toBeNull();
    expect(readCard({ ...good, ref: "../../admin" })).toBeNull();
    expect(readCard({ ...good, title: "  " })).toBeNull();
    expect(readCard({ ...good, title: "x".repeat(141) })).toBeNull();
    for (const bad of [null, undefined, "x", 3, [], [good]]) expect(readCard(bad)).toBeNull();
  });
  it("refuses any text that looks like a contact detail", () => {
    expect(readCard({ ...good, title: "Call 0803 123 4567" })).toBeNull();
    expect(readCard({ ...good, place: "me@mail.com" })).toBeNull();
    expect(readCard({ ...good, summary: "https://wa.me/234" })).toBeNull();
    expect(readCard({ ...good, summary: "Room available · ₦1,500,000/year" })).not.toBeNull();
    expect(looksLikeContact("12 - 14 Allen Avenue")).toBe(false);
    expect(looksLikeContact("+234 803 123 4567")).toBe(true);
  });
});
