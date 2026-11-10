import { describe, expect, it } from "vitest";

import type { BdActivity, BdProspect } from "@/lib/admin/business-development/types";
import type { Task } from "@/lib/admin/my-desk/model";
import type { SocialPost } from "@/lib/admin/social-media/model";

import { bdRows, socialRows, taskRows } from "./prefill";

const WEEK = "2026-11-09";
const IN = "2026-11-10T09:00:00Z";
const OUT = "2026-11-20T09:00:00Z";

const task = (over: Partial<Task>): Task => ({
  id: "t", title: "T", detail: "", assignedTo: "me", createdBy: "me", dueDate: null, status: "done", priority: "normal",
  relatedDesk: null, relatedLink: null, createdAt: IN, completedAt: IN, ...over,
});

const post = (over: Partial<SocialPost>): SocialPost => ({
  id: "p", platform: "instagram", category: "property", format: "feed_post", slot: null, campaign: null, caption: "",
  plannedAt: "2026-11-11", status: "posted", mediaUrls: [], approvedBy: null, approvedAt: null, postedAt: IN, liveUrl: null,
  rejectionReason: null, createdBy: null, createdAt: IN, updatedAt: IN, ...over,
});

const prospect = (over: Partial<BdProspect>): BdProspect => ({
  id: "x", contactName: "", businessName: "", category: "landlord", email: null, phone: null, location: null, stage: "new", notes: null,
  assignedTo: null, createdBy: null, listingId: null, onboardedAt: null, nextFollowUpAt: null, createdAt: IN, updatedAt: IN, ...over,
});

const activity = (over: Partial<BdActivity>): BdActivity => ({ id: "a", prospectId: "x", kind: "contact", body: "", outcome: null, actorId: null, createdAt: IN, ...over });

describe("prefilled rows", () => {
  it("counts only my tasks, done, completed inside the week", () => {
    const rows = taskRows([task({}), task({ assignedTo: "you" }), task({ status: "todo" }), task({ completedAt: OUT })], "me", WEEK);
    expect(rows).toEqual([{ label: "Tasks completed", value: 1, target: null, source: "desk", deskValue: 1 }]);
  });

  it("counts posts planned and posted by format, ignoring cancelled and other weeks", () => {
    const rows = socialRows(
      [post({}), post({ format: "reel" }), post({ status: "draft", postedAt: null }), post({ status: "cancelled", postedAt: null }), post({ plannedAt: "2026-11-25", postedAt: OUT })],
      WEEK,
    );
    const get = (label: string) => rows.find((r) => r.label === label)?.value;
    expect(get("Posts planned")).toBe(3);
    expect(get("Posts posted")).toBe(2);
    expect(get("Short-form video / reel planned")).toBe(1);
    expect(rows.every((r) => r.source === "desk" && r.target === null)).toBe(true);
  });

  it("counts the pipeline's own week", () => {
    const rows = bdRows(
      [prospect({}), prospect({ id: "y", createdAt: OUT, updatedAt: OUT }), prospect({ id: "z", onboardedAt: IN, listingId: "l" })],
      [activity({}), activity({ id: "b" }), activity({ id: "c", prospectId: "y" }), activity({ id: "d", kind: "follow_up" }), activity({ id: "e", createdAt: OUT })],
      WEEK,
    );
    const get = (label: string) => rows.find((r) => r.label === label)?.value;
    expect(get("Prospects identified")).toBe(2);
    expect(get("Businesses contacted")).toBe(2);
    expect(get("Follow-ups")).toBe(1);
    expect(get("Businesses onboarded")).toBe(1);
    expect(get("Listings submitted")).toBe(1);
  });
});
