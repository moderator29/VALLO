import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LISTING_STATUSES, listingProblems, EMPTY_LISTING, REVIEW_MIN_PHOTOS, type ListingDraft } from "./model";
import { decisionProblem, inReview, needsReview, ownerMoves, reviewTimeline, showsInFeed, statusAfter } from "./review";
import { mapQueueRow } from "./review-queue";

const good = { status: "submitted" as const, authority: "owner", declared: true, rentMinor: 100, photoCount: 3 };

describe("the review states", () => {
  it("only a room offer is reviewed, only live shows in the feed", () => {
    expect(needsReview("room_offer")).toBe(true);
    expect(needsReview("roommate_wanted")).toBe(false);
    expect(needsReview("together")).toBe(false);
    for (const s of LISTING_STATUSES) expect(showsInFeed(s)).toBe(s === "live");
    expect(inReview("in_review")).toBe(true);
    expect(inReview("live")).toBe(false);
  });

  it("draws a three-step timeline", () => {
    expect(reviewTimeline("submitted").map((s) => s.state)).toEqual(["done", "now", "todo"]);
    expect(reviewTimeline("changes_requested").map((s) => s.state)).toEqual(["done", "done", "stopped"]);
    expect(reviewTimeline("live").map((s) => s.state)).toEqual(["done", "done", "done"]);
    expect(reviewTimeline("draft")[0]?.state).toBe("now");
  });

  it("offers the owner only moves the database allows", () => {
    expect(ownerMoves("submitted", "room_offer", false)).toEqual(["withdraw"]);
    expect(ownerMoves("live", "room_offer", true)).toContain("pause");
    expect(ownerMoves("paused", "room_offer", false)).toContain("submit");
    expect(ownerMoves("paused", "room_offer", true)).toContain("resume");
    expect(ownerMoves("rejected", "room_offer", false)).toEqual([]);
  });

  it("needs three photos, a rent, an authority and a declaration to send a room offer", () => {
    const d: ListingDraft = { ...EMPTY_LISTING, kind: "room_offer", title: "A room in Yaba", city: "Lagos", rentMinor: 100, authority: "owner", declared: true, photos: [] };
    expect(listingProblems(d)).toEqual(["photos"]);
    expect(listingProblems({ ...d, photos: Array(REVIEW_MIN_PHOTOS).fill("a/b.jpg") })).toEqual([]);
    expect(listingProblems({ ...d, kind: "roommate_wanted" })).toEqual([]);
  });
});

describe("decisions", () => {
  it("approves a complete post waiting for review", () => {
    expect(decisionProblem("approve", "", good)).toBeNull();
  });

  it("holds the other approval rules", () => {
    expect(decisionProblem("approve", "", { ...good, photoCount: 2 })).toContain("three photos");
    expect(decisionProblem("approve", "", { ...good, declared: false })).toContain("declared");
    expect(decisionProblem("approve", "", { ...good, rentMinor: null })).toContain("no rent");
    expect(decisionProblem("approve", "", { ...good, status: "live" })).toContain("not waiting");
  });

  it("needs a reason for changes and a refusal, and a post waiting for claim", () => {
    expect(decisionProblem("changes", "no", good)).toContain("five characters");
    expect(decisionProblem("changes", "Add a clearer front photo", good)).toBeNull();
    expect(decisionProblem("reject", "", good)).toContain("five characters");
    expect(decisionProblem("reject", "Not the owner of the home", { ...good, status: "changes_requested" })).toBeNull();
    expect(decisionProblem("claim", "", good)).toBeNull();
    expect(decisionProblem("claim", "", { ...good, status: "in_review" })).not.toBeNull();
    expect(statusAfter("approve")).toBe("live");
    expect(statusAfter("changes")).toBe("changes_requested");
  });
});

describe("the queue row", () => {
  it("turns storage paths into URLs, hides nothing private", () => {
    const row = mapQueueRow(
      { id: "1", title: "t", status: "submitted", city: "Lagos", area: null, stateCode: "LA", description: null, rentMinor: 5, rentPeriod: "year", authority: "owner", declaredAt: "2026-11-01", photoCount: 1, photoPaths: ["u/a.jpg"], linkedListingId: null, submittedAt: null, reviewedAt: null, reviewNote: null, owner: null, ownerVerified: null, openCases: 0 },
      "https://x.supabase.co",
    );
    expect(row.photoUrls[0]).toBe("https://x.supabase.co/storage/v1/object/public/roommate-photos/u/a.jpg");
    expect(row.declared).toBe(true);
    expect(Object.keys(row)).not.toContain("phone");
  });
});

describe("roommates_8 SQL", () => {
  const sql = readFileSync(join(process.cwd(), "../../supabase/migrations/pending/roommates_8_listing_review_2026-11-10.sql"), "utf8");
  it("is additive, repeatable and keeps FKs nullable with SET NULL", () => {
    expect(sql).toContain("add column if not exists reviewed_by uuid references public.profiles(id) on delete set null");
    expect(sql).not.toMatch(/drop table|drop column/i);
    expect(sql).toContain("drop trigger if exists roommate_listings_guard");
    expect(sql).not.toContain("—");
  });
  it("keeps a room offer out of live without approval (identity is the app's wall)", () => {
    expect(sql).toContain("roommate_listings_review_shape");
    expect(sql).not.toContain("roommate_identity_state");
    expect(sql).toContain("cardinality(l.photos) < 3");
  });
});
