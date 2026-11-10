import { z } from "zod";
import { getReports } from "@/lib/admin/queries";
import { getModerationQueue } from "@/lib/admin/moderation-queries";
import { getModerationSummary } from "@/lib/admin/reads/moderation";
import { capList, clampLimit, clip, oldestFirst, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool } from "./types";

/** Reports, flags and held content (`/admin/queue`, the moderation lanes). */

export const getModerationOverview = defineTool({
  name: "get_moderation_queue",
  description:
    "Moderation desk: open and in-review reports by category, how much content the safety scan is holding (posts, stories, comments, bios, events), what is older than a day, response times, and the oldest open reports and held items with their ages.",
  kind: "read",
  scopes: ["moderation"],
  status: "Reading the moderation queue",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["moderation"]);
    if (!gate.ok) return refused();
    const [summary, reports, held] = await Promise.all([getModerationSummary(ctx.now), getReports({}), getModerationQueue({})]);
    if (summary.state !== "ok") return unreadable("The moderation summary");
    const limit = clampLimit(input.limit, 6);
    const open = reports.state === "ok" ? oldestFirst(reports.data.rows.filter((r) => r.status === "open" || r.status === "reviewing"), (r) => r.createdAt) : null;
    const heldItems = [
      ...held.posts.map((p) => ({ kind: "post", id: p.id, createdAt: p.createdAt, holdReason: clip(p.holdReason, 120) })),
      ...held.stories.map((s) => ({ kind: "story", id: s.id, createdAt: s.createdAt, holdReason: clip(s.holdReason, 120) })),
      ...held.comments.map((c) => ({ kind: "comment", id: c.id, createdAt: c.createdAt, holdReason: clip(c.holdReason, 120) })),
    ];
    const heldOldest = oldestFirst(heldItems, (h) => h.createdAt).map((h) => ({ ...h, waitingHours: waitingHours(h.createdAt, ctx.now), link: "/admin/queue" }));
    return {
      ok: true,
      data: {
        summary: summary.data,
        openReports: open
          ? capList(
              open.map((r) => ({
                id: r.id,
                category: r.category ?? "uncategorised",
                targetType: r.targetType,
                status: r.status,
                reason: clip(r.reason, 160),
                createdAt: r.createdAt,
                waitingHours: waitingHours(r.createdAt, ctx.now),
                link: "/admin/queue",
              })),
              limit,
              open.length,
            )
          : null,
        heldContentTotal: held.total,
        oldestHeld: capList(heldOldest, limit, heldOldest.length),
        page: "/admin/queue",
      },
    };
  },
});

export const MODERATION_TOOLS = [getModerationOverview];
