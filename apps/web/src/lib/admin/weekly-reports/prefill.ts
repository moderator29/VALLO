import type { BdActivity, BdProspect } from "@/lib/admin/business-development/types";
import type { Task } from "@/lib/admin/my-desk/model";
import { FORMAT_LABEL, type SocialPost } from "@/lib/admin/social-media/model";

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
