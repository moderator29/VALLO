import { z } from "zod";
import { requireCoo } from "@/lib/admin/overview/guard";
import { listEscalations, listStaffAccessRecommendations, readCooBacklog, type BacklogCard } from "@/lib/admin/overview/reads";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { capList, clampLimit, clip, refused, unreadable, waitingHours } from "./common";
import { defineTool, type CopilotViewer } from "./types";

/**
 * The COO desk (`/admin/overview`): escalations raised to the COO, staff access
 * recommendations, and the cross-desk backlog. The COO door is the desk's own
 * (`requireCoo`): a super admin or a holder of the full COO bundle.
 */

export const cooAllowed = (v: CopilotViewer): boolean =>
  v.isSuperAdmin || JOB_DESCRIPTIONS.coo.scopes.every((s) => v.scopes.includes(s));

const link = "/admin/overview";

const card = (c: BacklogCard, now: number) =>
  c.state === "ok"
    ? { count: c.count, cappedAtReadLimit: c.capped, oldest: c.items.slice(0, 3).map((i) => ({ id: i.id, title: clip(i.title, 100), waitingHours: waitingHours(i.createdAt, now), link: i.href })) }
    : null;

export const getCooDesk = defineTool({
  name: "get_coo_desk",
  description:
    "COO desk: open escalations with who raised them and how long they have waited, staff access recommendations still open, and the cross-desk backlog (listings, moderation, support, agreements, operations) with counts and the oldest few items.",
  kind: "read",
  scopes: ["operations"],
  allow: cooAllowed,
  status: "Reading the COO desk",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const door = await requireCoo();
    if (door.state !== "coo" || door.user.id !== ctx.viewer.userId) return refused();
    const [backlog, escalations, recs] = await Promise.all([readCooBacklog(door.supabase), listEscalations(), listStaffAccessRecommendations()]);
    if (escalations.state === "unavailable" && backlog.listings.state !== "ok") return unreadable("The COO desk");
    const open = escalations.state === "ok" ? escalations.data.filter((e) => e.status !== "resolved") : null;
    const openRecs = recs.state === "ok" ? recs.data.filter((r) => r.status === "open") : null;
    const limit = clampLimit(input.limit, 6);
    return {
      ok: true,
      data: {
        openEscalations: open
          ? capList(open.map((e) => ({ id: e.id, fromDesk: e.sourceDesk, subject: clip(e.subject, 140), detail: clip(e.detail, 240), status: e.status, waitingHours: waitingHours(e.createdAt, ctx.now), link })), limit, open.length)
          : null,
        accessRecommendations: openRecs ? capList(openRecs.map((r) => ({ id: r.id, about: r.aboutName, recommends: r.recommendedPositionOrScope, reason: clip(r.reason, 200), link })), limit, openRecs.length) : null,
        backlog: { listings: card(backlog.listings, ctx.now), moderation: card(backlog.moderation, ctx.now), support: card(backlog.support, ctx.now), agreements: card(backlog.agreements, ctx.now), operations: card(backlog.operations, ctx.now) },
        page: link,
      },
    };
  },
});

export const COO_TOOLS = [getCooDesk];
