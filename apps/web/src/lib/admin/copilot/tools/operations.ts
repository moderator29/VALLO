import { z } from "zod";
import { getRiskAlerts } from "@/lib/admin/queries";
import { getAlertTrend, getInspectionActivity, getJobHealth } from "@/lib/admin/reads/operations";
import { getBookingsDesk } from "@/lib/admin/reads/bookings";
import { capList, clampLimit, clip, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool } from "./types";

/** Operations (`/admin/operations`, `/admin/alerts`, `/admin/bookings`): alerts, jobs, bookings, visits. */

export const getOperationsOverview = defineTool({
  name: "get_operations_overview",
  description:
    "Operations desk: open risk alerts by severity with the newest few, whether any scheduled job is stale or failed, the alert trend against last week, and inspections (visits) by state.",
  kind: "read",
  scopes: ["operations"],
  status: "Reading Operations",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["operations"]);
    if (!gate.ok) return refused();
    const [alerts, jobs, trend, visits] = await Promise.all([getRiskAlerts({}), getJobHealth(ctx.now), getAlertTrend(ctx.now), getInspectionActivity()]);
    if (alerts.state !== "ok" && jobs.state !== "ok") return unreadable("Operations");
    const open = alerts.state === "ok" ? alerts.data.rows.filter((a) => a.status !== "resolved") : null;
    const bySeverity = open ? open.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.severity]: (acc[a.severity] ?? 0) + 1 }), {}) : null;
    return {
      ok: true,
      data: {
        openAlerts: open ? { total: open.length, bySeverity, newest: capList(open.map((a) => ({ id: a.id, severity: a.severity, status: a.status, title: clip(a.title, 140), raisedHoursAgo: waitingHours(a.createdAt, ctx.now), link: "/admin/alerts" })), clampLimit(input.limit, 6), open.length) } : null,
        jobs: jobs.state === "ok" ? { total: jobs.data.health.jobs.length, stale: jobs.data.health.jobs.filter((j) => j.stale).map((j) => j.name), failed: jobs.data.health.jobs.filter((j) => j.lastOutcome === "failed").map((j) => j.name), checkedAt: jobs.data.health.checkedAt } : null,
        alertTrend: trend.state === "ok" ? { openNow: trend.data.openNow, openWeekAgo: trend.data.openWeekAgo } : null,
        visits: visits.state === "ok" ? { byState: visits.data.byState, total: visits.data.total } : null,
        page: "/admin/operations",
      },
    };
  },
});

export const getBookingsOverview = defineTool({
  name: "get_bookings_overview",
  description: "Bookings: counts by state (requested, confirmed, in stay, completed, no-show, cancelled, refunded) and created this week, plus the newest bookings with links. Amounts are as the Bookings desk shows them.",
  kind: "read",
  scopes: ["operations"],
  status: "Reading bookings",
  input: z.object({ status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"]).optional(), limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["operations"]);
    if (!gate.ok) return refused();
    const read = await getBookingsDesk({ page: 1, pageSize: clampLimit(input.limit, 6), ...(input.status ? { status: input.status } : {}) }, ctx.now);
    if (read.state !== "ok") return unreadable("Bookings");
    return {
      ok: true,
      data: {
        counts: read.data.counts,
        newest: capList(
          read.data.table.rows.map((b) => ({ id: b.id, status: b.status, listing: b.listingTitle, place: b.place, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, totalMinor: b.totalMinor, paidMinor: b.paidMinor, refundedMinor: b.refundedMinor, link: `/admin/bookings/${b.id}` })),
          clampLimit(input.limit, 6),
          read.data.table.total,
        ),
        page: "/admin/bookings",
      },
    };
  },
});

export const OPERATIONS_TOOLS = [getOperationsOverview, getBookingsOverview];
