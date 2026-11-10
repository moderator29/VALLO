import type { BdActivity, BdProspect } from "@/lib/admin/business-development/types";
import type { Task } from "@/lib/admin/my-desk/model";
import type { Campaign, CampaignResult } from "@/lib/admin/marketing/model";
import type { ContentItem } from "@/lib/admin/content/model";
import type { Entry } from "@/lib/admin/desk-entries/model";
import { FORMAT_LABEL, type SocialPost } from "@/lib/admin/social-media/model";
import type { PolicyNote, QaReview } from "@/lib/admin/support-lead/model";
import type { Incident } from "@/lib/admin/technical/model";

import type { NumberRow } from "./model";
import { inWeek } from "./week";

/**
 * THE NUMBERS THE DESKS CAN COUNT FOR A WEEK. Pure: rows in, rows out, so
 * every figure is tested and none is invented. Each row is marked
 * `source: "desk"` with its `deskValue`; the person may still change it.
 * Only the figures a desk really holds are produced. There are no targets
 * here: a target is the person's own to type.
 */

function row(label: string, value: number): NumberRow {
  return { label, value, target: null, source: "desk", deskValue: value };
}

/** Everyone: tasks assigned to the person that were completed inside the week. */
export function taskRows(tasks: readonly Task[], userId: string, weekStart: string): NumberRow[] {
  const done = tasks.filter((t) => t.assignedTo === userId && t.status === "done" && inWeek(weekStart, t.completedAt)).length;
  return [row("Tasks completed", done)];
}

/** Social Media Manager: posts planned and posted in the week, by format. */
export function socialRows(posts: readonly SocialPost[], weekStart: string): NumberRow[] {
  const planned = posts.filter((p) => p.status !== "cancelled" && inWeek(weekStart, `${p.plannedAt}T12:00:00+01:00`));
  const posted = posts.filter((p) => p.status === "posted" && inWeek(weekStart, p.postedAt));
  const rows: NumberRow[] = [row("Posts planned", planned.length), row("Posts posted", posted.length)];
  for (const format of ["feed_post", "reel", "story"] as const) {
    rows.push(row(`${FORMAT_LABEL[format]} planned`, planned.filter((p) => p.format === format).length));
    rows.push(row(`${FORMAT_LABEL[format]} posted`, posted.filter((p) => p.format === format).length));
  }
  return rows;
}

/**
 * Business Development Director: the pipeline's own week. "Listings
 * submitted" counts prospects linked to a listing whose record changed in the
 * week, since the link carries no date of its own.
 */
export function bdRows(prospects: readonly BdProspect[], activity: readonly BdActivity[], weekStart: string): NumberRow[] {
  const weekActivity = activity.filter((a) => inWeek(weekStart, a.createdAt));
  const contacted = new Set(weekActivity.filter((a) => a.kind === "contact").map((a) => a.prospectId));
  return [
    row("Prospects identified", prospects.filter((p) => inWeek(weekStart, p.createdAt)).length),
    row("Businesses contacted", contacted.size),
    row("Follow-ups", weekActivity.filter((a) => a.kind === "follow_up").length),
    row("Businesses onboarded", prospects.filter((p) => inWeek(weekStart, p.onboardedAt)).length),
    row("Listings submitted", prospects.filter((p) => p.listingId !== null && inWeek(weekStart, p.updatedAt)).length),
  ];
}

/* --------------------------------------------- the four desks of 10 November */

const made = (entries: readonly Entry[], kind: string, weekStart: string) => entries.filter((e) => e.kind === kind && inWeek(weekStart, e.createdAt)).length;

/** Marketing Manager: what was planned, approved and logged in the week. */
export function marketingRows(campaigns: readonly Campaign[], results: readonly CampaignResult[], entries: readonly Entry[], weekStart: string): NumberRow[] {
  return [
    row("Campaigns planned", campaigns.filter((c) => inWeek(weekStart, c.createdAt)).length),
    row("Campaigns approved", campaigns.filter((c) => inWeek(weekStart, c.approvedAt)).length),
    row("Campaigns started", campaigns.filter((c) => c.status !== "cancelled" && c.status !== "draft" && c.startsOn !== null && inWeek(weekStart, `${c.startsOn}T12:00:00+01:00`)).length),
    row("Results logged", results.filter((r) => !r.voidedAt && inWeek(weekStart, r.createdAt)).length),
    row("Creative briefs written", made(entries, "creative_brief", weekStart)),
    row("A/B tests logged", made(entries, "ab_test", weekStart)),
  ];
}

/** Content Manager: what was written, approved and published in the week. */
export function contentRows(items: readonly ContentItem[], entries: readonly Entry[], weekStart: string): NumberRow[] {
  return [
    row("Items started", items.filter((i) => inWeek(weekStart, i.createdAt)).length),
    row("Items approved", items.filter((i) => inWeek(weekStart, i.approvedAt)).length),
    row("Items published", items.filter((i) => i.status === "published" && inWeek(weekStart, i.publishedAt)).length),
    row("Requests received", made(entries, "content_request", weekStart)),
    row("Help gaps logged", made(entries, "docs_gap", weekStart)),
    row("Checklists run", made(entries, "seo_check", weekStart) + made(entries, "publish_check", weekStart)),
  ];
}

/** Technical Administrator: incidents declared and resolved, and the notes kept. */
export function technicalRows(incidents: readonly Incident[], entries: readonly Entry[], weekStart: string): NumberRow[] {
  return [
    row("Incidents declared", incidents.filter((i) => inWeek(weekStart, i.startedAt)).length),
    row("Incidents resolved", incidents.filter((i) => inWeek(weekStart, i.resolvedAt)).length),
    row("Post-incident reviews written", made(entries, "incident_review", weekStart)),
    row("Runbooks written", made(entries, "runbook", weekStart)),
    row("Release notes written", made(entries, "release_note", weekStart)),
  ];
}

/** Customer Support Lead: reviews, coaching and policy work in the week. */
export function supportLeadRows(reviews: readonly QaReview[], policy: readonly PolicyNote[], entries: readonly Entry[], weekStart: string): NumberRow[] {
  return [
    row("Quality reviews written", reviews.filter((r) => inWeek(weekStart, r.createdAt)).length),
    row("Coaching notes written", made(entries, "coaching_note", weekStart)),
    row("Policy notes written", policy.filter((p) => inWeek(weekStart, p.createdAt)).length),
    row("Policy notes approved", policy.filter((p) => inWeek(weekStart, p.approvedAt)).length),
    row("Canned replies written", made(entries, "macro", weekStart)),
    row("Knowledge-base gaps logged", made(entries, "kb_gap", weekStart)),
  ];
}
