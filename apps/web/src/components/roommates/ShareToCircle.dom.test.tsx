import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";

import { RoommateCircleCard } from "@/components/social/circle/RoommateCircleCard";
import type { CircleRoommateCard } from "@/lib/features/circle/roommate-card";

import { ShareToCircleBody, type Load } from "./ShareToCircle";

const t = getDictionary("en").roommates;
const w = t.circleShare;
const circles = [
  { id: "a", slug: "finding-roommates", name: "Finding roommates", category: "roommates", visibility: "public" as const },
  { id: "b", slug: "closed-house", name: "Closed house", category: "student_housing", visibility: "private" as const },
];
const html = (load: Load, picked: string | null = null) =>
  renderToStaticMarkup(<ShareToCircleBody load={load} picked={picked} note="" words={w} optional="Optional" onPick={() => {}} onNote={() => {}} onRetry={() => {}} />);

describe("the Share to a Circle sheet, by state", () => {
  it("loading says it is finding the Circles and offers nothing to pick", () => {
    const out = html({ state: "loading" });
    expect(out).toContain('data-state="loading"');
    expect(out).toContain(w.loading);
    expect(out).not.toContain("circle-share-option");
  });

  it("a failed load says so and offers Try again", () => {
    const out = html({ state: "failed", message: w.loadFailed });
    expect(out).toContain('data-state="failed"');
    expect(out).toContain(w.loadFailed);
    expect(out).toContain("circle-share-retry");
  });

  it("in no Circle: an honest empty state with a way to find one", () => {
    const out = html({ state: "ready", circles: [], memberOf: 0 });
    expect(out).toContain('data-state="none"');
    expect(out).toContain(w.emptyNone);
    expect(out).toContain('href="/circle"');
    expect(out).toContain(w.findCircle);
    expect(out).not.toContain("circle-share-option");
  });

  it("in Circles that cannot take a post: says that instead, still with the way to find another", () => {
    const out = html({ state: "ready", circles: [], memberOf: 2 });
    expect(out).toContain('data-state="blocked"');
    expect(out).toContain(w.emptyBlocked);
    expect(out).not.toContain(w.emptyNone);
    expect(out).toContain('href="/circle"');
  });

  it("the list names each Circle, marks the chosen one, and has the optional short note", () => {
    const out = html({ state: "ready", circles, memberOf: 2 }, "b");
    expect(out).toContain('data-state="list"');
    expect(out).toContain("Finding roommates");
    expect(out).toContain("Closed house");
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(out.match(/aria-pressed="false"/g)).toHaveLength(1);
    expect(out).toContain(w.noteLabel);
    expect(out).toContain('maxLength="280"');
  });
});

describe("the Roommates card in a Circle post", () => {
  const ID = "0b9f6d3e-1d6f-4f0e-9a52-6f8a5c1d2e33";
  const room: CircleRoommateCard = { v: 1, kind: "room", ref: ID, title: "Sunny room in Yaba", place: "Yaba, Lagos", summary: "Room available · ₦80,000/year" };
  const person: CircleRoommateCard = { v: 1, kind: "person", ref: ID, title: "Tolu", place: "UNILAG · Akoka", summary: "Looking for a room" };

  it("a room card shows the title, area and summary, and links to the real post page", () => {
    const out = renderToStaticMarkup(<RoommateCircleCard card={room} />);
    expect(out).toContain(`href="/roommates/r/${ID}"`);
    expect(out).toContain("Sunny room in Yaba");
    expect(out).toContain("Yaba, Lagos");
    expect(out).toContain("Room available");
    expect(out).toContain(w.cardKicker);
    expect(out).toContain(w.viewRoom);
  });

  it("a person card shows the first name only and links to the profile", () => {
    const out = renderToStaticMarkup(<RoommateCircleCard card={person} />);
    expect(out).toContain(`href="/roommates/p/${ID}"`);
    expect(out).toContain("Tolu");
    expect(out).toContain(w.viewPerson);
  });

  it("inside a feed card (already a link) it is a plain block with no nested link", () => {
    const out = renderToStaticMarkup(<RoommateCircleCard card={room} link={false} />);
    expect(out).not.toContain("<a ");
    expect(out).toContain("Sunny room in Yaba");
  });
});
