import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { strCasesFrom } from "@/lib/admin/str";
import { readThresholdLane } from "@/lib/compliance/threshold-queries";
import { readSanctionsDesk } from "@/lib/compliance/sanctions/desk";
import { recheck, refused, unreadable } from "./common";
import { defineTool } from "./types";

/**
 * Compliance lanes (`/admin/compliance`): COUNTS ONLY. Suspicious transaction
 * grounds, party names and sanctions matches stay on the desk; a filing or a
 * decision is made by a human compliance officer, never by the copilot.
 */

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

export const getComplianceLanes = defineTool({
  name: "get_compliance_lanes",
  description:
    "Compliance lanes, counts only: suspicious transaction cases by state and how many are overdue, threshold reports by state, and sanctions screening hits waiting. No names, grounds or amounts.",
  kind: "read",
  scopes: ["compliance"],
  status: "Reading the compliance lanes",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["compliance"]);
    if (!gate.ok) return refused();
    const access = await requireAdmin("compliance");
    if (access.state !== "admin") return refused();
    const db = access.userClient as unknown as Rpc;
    const [str, threshold, sanctions] = await Promise.all([
      db.rpc("str_cases"),
      readThresholdLane(),
      db.rpc("sanctions_desk"),
    ]);
    const cases = str.error ? null : strCasesFrom(str.data);
    const desk = readSanctionsDesk(sanctions.data, sanctions.error);
    if (!cases && threshold.state !== "ready" && desk.state !== "ok") return unreadable("The compliance lanes");
    const byState = (rows: { state: string }[]) => rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }), {});
    return {
      ok: true,
      data: {
        suspiciousTransactionCases: cases ? { total: cases.length, byState: byState(cases), overdue: cases.filter((c) => c.overdue).length } : null,
        thresholdReports: threshold.state === "ready" ? { total: threshold.rows.length, byState: byState(threshold.rows), monitorFaults: threshold.monitorFaults } : null,
        sanctions: desk.state === "ok" ? { hitsWaiting: desk.hits.length, listsWaitingForSecondPerson: desk.waitingLists.length } : null,
        page: "/admin/compliance",
      },
    };
  },
});

export const COMPLIANCE_TOOLS = [getComplianceLanes];
