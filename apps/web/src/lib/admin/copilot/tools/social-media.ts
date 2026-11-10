import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { readSocialPosts } from "@/lib/admin/social-media/queries";
import { PLATFORM_LABEL, STATUS_LABEL, buildReportSummary, buildWeekGrid, isOverdue, weekdaysOf, type SocialPost } from "@/lib/admin/social-media/model";
import { capList, clampLimit, clip, recheck, refused, unreadable } from "./common";
import { defineTool } from "./types";

/** The social media planning desk (`/admin/social-media`): the week grid, drafts and the report. A planning tool; nothing is posted from here. */

const link = "/admin/social-media";

const postRow = (p: SocialPost) => ({
  id: p.id,
  platform: PLATFORM_LABEL[p.platform],
  category: p.category,
  format: p.format,
  status: STATUS_LABEL[p.status],
  plannedAt: p.plannedAt,
  campaign: p.campaign,
  caption: clip(p.caption, 120),
  sentBackReason: clip(p.rejectionReason, 160),
  link,
});

async function posts(ctx: Parameters<typeof recheck>[0]) {
  const gate = await recheck(ctx, ["social_media"]);
  if (!gate.ok) return null;
  const access = await requireAdmin("social_media");
  if (access.state !== "admin") return null;
  return readSocialPosts(access.supabase);
}

export const getSocialDesk = defineTool({
  name: "get_social_desk",
  description:
    "Social media desk: this week's calendar grid (Monday to Friday, four slots a day), posts overdue, drafts waiting or sent back, and the report counts (scheduled this week, posted this month by platform).",
  kind: "read",
  scopes: ["social_media"],
  status: "Reading the content calendar",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const read = await posts(ctx);
    if (read === null) return refused();
    if (read.state === "not-open") return { ok: false, error: "The social media desk is not set up on this server yet. Say so; do not guess." };
    if (read.state !== "ok") return unreadable("The content calendar");
    const today = new Date(ctx.now);
    const grid = buildWeekGrid(weekdaysOf(today), read.data);
    const week = grid.map((d) => ({
      day: d.day,
      label: d.label,
      posts: [...Object.values(d.slots).flat(), ...d.unslotted].filter((p) => p.status !== "cancelled").map(postRow),
    }));
    const drafts = read.data.filter((p) => p.status === "draft" || p.status === "awaiting_approval");
    return {
      ok: true,
      data: {
        week,
        overdue: capList(read.data.filter((p) => isOverdue(p, today)).map(postRow), clampLimit(input.limit, 6)),
        draftsAndWaiting: capList(drafts.map(postRow), clampLimit(input.limit, 6), drafts.length),
        report: buildReportSummary(read.data, today),
        page: link,
      },
    };
  },
});

export const SOCIAL_TOOLS = [getSocialDesk];
