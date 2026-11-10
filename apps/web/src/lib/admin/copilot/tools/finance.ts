import { z } from "zod";
import { getRefundConsole } from "@/lib/admin/money-queries";
import { getReconciliationHealth, getRentCharges } from "@/lib/admin/reads/money";
import { getChargebackDesk } from "@/lib/admin/reads/chargebacks";
import { getPaymentsDesk } from "@/lib/admin/reads/payments";
import { isUndecided } from "@/lib/admin/reads/chargebacks-model";
import { capList, clampLimit, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool } from "./types";

/**
 * Finance (`/admin/money`, `/admin/chargebacks`, `/admin/payments`). Counts
 * and amounts only, read through the finance desk's own functions. The
 * copilot never moves money and never decides a refund or a chargeback: it
 * reads, explains and links to the desk where a human decides.
 */

export const getMoneyOverview = defineTool({
  name: "get_money_overview",
  description:
    "Finance desk headline: the last reconciliation run and whether it was clean, tenancy charges by state with totals, and refunds decided with how many are not yet submitted to the processor. Vallo never holds customer money; this is the record of what the processor settled.",
  kind: "read",
  scopes: ["finance"],
  status: "Reading the Money desk",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["finance"]);
    if (!gate.ok) return refused();
    const [recon, rent, refunds] = await Promise.all([getReconciliationHealth(), getRentCharges(0), getRefundConsole({})]);
    if (recon.state !== "ok" && rent.state !== "ok" && refunds.state !== "ok") return unreadable("The Money desk");
    return {
      ok: true,
      data: {
        reconciliation: recon.state === "ok" ? { ...recon.data, lastRunHoursAgo: waitingHours(recon.data.lastRunAt, ctx.now) } : null,
        tenancyCharges: rent.state === "ok" ? { total: rent.data.total, byState: rent.data.byState, paidMinor: rent.data.paidMinor, awaitingMinor: rent.data.awaitingMinor, complete: rent.data.complete } : null,
        refunds: refunds.state === "ok" ? refunds.data.totals : null,
        page: "/admin/money",
      },
    };
  },
});

export const getChargebacks = defineTool({
  name: "get_chargebacks",
  description:
    "Chargebacks: counts by state, how many are undecided or owed, and the ones with evidence due soonest (reference, amount, state, due date, link). The decision and the evidence are for the human on the chargeback page.",
  kind: "read",
  scopes: ["finance"],
  status: "Reading the chargebacks",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["finance"]);
    if (!gate.ok) return refused();
    const read = await getChargebackDesk();
    if (read.state !== "ok") return unreadable("The chargebacks");
    const undecided = read.data.rows.filter((r) => isUndecided(r.state)).sort((a, b) => (a.evidenceDueAt ?? "9999").localeCompare(b.evidenceDueAt ?? "9999"));
    return {
      ok: true,
      data: {
        counts: read.data.counts,
        undecidedByEvidenceDue: capList(
          undecided.map((r) => ({ id: r.id, reference: r.reference, state: r.state, amountMinor: r.amountMinor, currency: r.currency, evidenceDueAt: r.evidenceDueAt, openedHoursAgo: waitingHours(r.openedAt, ctx.now), link: `/admin/chargebacks/${r.id}` })),
          clampLimit(input.limit, 6),
          undecided.length,
        ),
        page: "/admin/chargebacks",
      },
    };
  },
});

export const getPaymentsSummary = defineTool({
  name: "get_payments_summary",
  description: "Payments by outcome (succeeded, initialised, abandoned, failed, refunded): counts for this week and last week and the last 30 days, and succeeded amounts by channel. No individual payment details.",
  kind: "read",
  scopes: ["finance"],
  status: "Reading payments",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["finance"]);
    if (!gate.ok) return refused();
    const read = await getPaymentsDesk({ page: 1, pageSize: 1 }, ctx.now);
    if (read.state !== "ok") return unreadable("Payments");
    const d = read.data;
    return {
      ok: true,
      data: {
        week: d.week,
        last30DaysByOutcome: d.last30,
        byChannel: d.byChannel.slice(0, 8),
        totalAttemptsRead: d.table.total,
        complete: d.complete,
        page: "/admin/payments",
      },
    };
  },
});

export const FINANCE_TOOLS = [getMoneyOverview, getChargebacks, getPaymentsSummary];
