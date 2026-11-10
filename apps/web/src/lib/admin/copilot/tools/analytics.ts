import { z } from "zod";
import { getBookingOutcomes } from "@/lib/admin/reads/analytics";
import { getConsolePulse } from "@/lib/admin/reads/overview";
import { recheck, refused, unreadable } from "./common";
import { defineTool } from "./types";

/** Analytics headline numbers (`/admin/analytics`, `/admin/overview`), read-only. */

export const getAnalyticsHeadline = defineTool({
  name: "get_analytics_headline",
  description:
    "Platform headline numbers: live listings now against a week ago, sign-ups today and yesterday, money collected today, yesterday and this week against last (kobo), new listings submitted this week, and bookings that went through over 30 or 90 days. Example listings and internal accounts are already left out.",
  kind: "read",
  scopes: ["analyst"],
  status: "Reading the headline numbers",
  input: z.object({ range: z.enum(["30d", "90d"]).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["analyst"]);
    if (!gate.ok) return refused();
    const [pulse, bookings] = await Promise.all([getConsolePulse(ctx.now), getBookingOutcomes(input.range ?? "30d", ctx.now)]);
    if (pulse.state !== "ok" && bookings.state !== "ok") return unreadable("The headline numbers");
    const p = pulse.state === "ok" ? pulse.data : null;
    return {
      ok: true,
      data: {
        pulse: p ? { ...p, daily: undefined } : null,
        bookingsThatWentThrough: bookings.state === "ok" ? { range: input.range ?? "30d", ...bookings.data } : null,
        page: "/admin/analytics",
      },
    };
  },
});

export const ANALYTICS_TOOLS = [getAnalyticsHeadline];
