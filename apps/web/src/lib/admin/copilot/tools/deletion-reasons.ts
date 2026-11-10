import { z } from "zod";

import { ACCOUNT_DELETION_SCOPES } from "@/lib/admin/account-deletions/door-scopes";
import { RANGES, aggregate, parseRange } from "@/lib/admin/account-deletions/model";
import { readDeletionReasons } from "@/lib/admin/account-deletions/read";
import { recheck, refused, unreadable } from "./common";
import { defineTool } from "./types";

/**
 * WHY MEMBERS DELETE THEIR ACCOUNT, for the copilot (founder, 10 November
 * 2026). Aggregates only: counts, shares, the trend and the restored count.
 * Never a note, never a row, never a user id, whoever is asking.
 */
export const getDeletionReasons = defineTool({
  name: "get_deletion_reasons",
  description:
    "Why members asked to delete their account over 7, 30 or 90 days or all time: the total, each reason with its count and percentage, the change on the previous period, how many were restored within 30 days and the share who gave no reason. Aggregates only, never a person or a note.",
  kind: "read",
  scopes: ACCOUNT_DELETION_SCOPES,
  status: "Reading deletion reasons",
  input: z.object({ range: z.enum(RANGES).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ACCOUNT_DELETION_SCOPES);
    if (!gate.ok) return refused();
    const read = await readDeletionReasons(gate.door.supabase as never, false);
    if (read.state === "not-switched-on") {
      return { ok: false, error: "Deletion reasons are not switched on yet on this server (the table is missing). Say so; do not guess." };
    }
    if (read.state !== "ok") return unreadable("The deletion reasons");
    const a = aggregate(read.rows, parseRange(input.range), ctx.now, false);
    return {
      ok: true,
      data: {
        range: a.range,
        total: a.total,
        reasons: a.lines.map((l) => ({ reason: l.label, count: l.count, percent: l.percent })),
        previousPeriodTotal: a.previousTotal,
        changePercent: a.trendPercent,
        restoredWithin30Days: a.restored,
        restoredPercent: a.restoredPercent,
        notGivenPercent: a.notGivenPercent,
        page: "/admin/account-deletions",
      },
    };
  },
});

export const DELETION_REASON_TOOLS = [getDeletionReasons];
