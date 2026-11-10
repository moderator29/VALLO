import { addDays, isIsoDate, lagosToday, mondayOfIso, nairaFromKobo } from "@/lib/admin/desk-rules";

import { CAMPAIGN_STATUS_LABEL, CHANNEL_LABEL, budgetLines, metricTotals, type Campaign, type CampaignResult } from "./model";

/**
 * THE MARKETING DESK'S DERIVED VIEWS: the campaign calendar and the monthly
 * report text. Pure and client-safe; every figure comes from the campaigns and
 * the numbers the manager logged, and a figure that was never logged is said
 * to be not logged, never written as zero.
 */

export type CalendarRow = { start: string; label: string; campaigns: Campaign[] };

/** The campaigns running in each Monday-start week of a month (YYYY-MM), cancelled ones left out. */
export function campaignCalendar(campaigns: readonly Campaign[], month: string): CalendarRow[] {
  const first = `${month}-01`;
  if (!/^\d{4}-\d{2}$/.test(month) || !isIsoDate(first)) return [];
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const last = `${month}-${String(lastDay).padStart(2, "0")}`;
  const rows: CalendarRow[] = [];
  for (let start = mondayOfIso(first); start <= last; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    rows.push({
      start,
      label: `${start} to ${end}`,
      campaigns: campaigns.filter((c) => c.status !== "cancelled" && c.startsOn !== null && c.startsOn <= end && (c.endsOn ?? c.startsOn) >= start),
    });
  }
  return rows;
}

export function currentMonth(now: number = Date.now()): string {
  return lagosToday(now).slice(0, 7);
}

/** Campaigns that overlap on the same channel on any day: two pushes into one audience at once. */
export function channelClashes(campaigns: readonly Campaign[]): [Campaign, Campaign][] {
  const live = campaigns.filter((c) => c.status !== "cancelled" && c.status !== "ended" && c.startsOn && c.endsOn);
  const out: [Campaign, Campaign][] = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i]!;
      const b = live[j]!;
      if (a.channel === b.channel && a.startsOn! <= b.endsOn! && b.startsOn! <= a.endsOn!) out.push([a, b]);
    }
  }
  return out;
}

/**
 * A first draft of the monthly report. The manager edits it, adds their own
 * reading and sends it for approval. Money is stated as what was logged
 * against a budget, not as a claim about what Vallo holds.
 */
export function buildMonthlyReport(input: { month: string; campaigns: readonly Campaign[]; results: readonly CampaignResult[]; signups: number | null }): string {
  const { month, campaigns, results } = input;
  const inMonth = results.filter((r) => !r.voidedAt && r.recordedOn.startsWith(month));
  const ran = campaigns.filter((c) => c.status !== "cancelled" && c.status !== "draft" && c.startsOn !== null && c.startsOn.slice(0, 7) <= month && (c.endsOn ?? c.startsOn).slice(0, 7) >= month);
  const lines: string[] = [`Marketing report, ${month}`, ""];
  lines.push(`Campaigns that ran: ${ran.length}.`);
  for (const c of ran) {
    const forMonth = inMonth.filter((r) => r.campaignId === c.id);
    const spend = forMonth.filter((r) => r.metric === "spend_kobo").reduce((t, r) => t + r.value, 0);
    const totals = metricTotals(forMonth, c.id);
    const parts = [
      forMonth.some((r) => r.metric === "spend_kobo") ? `spend ${nairaFromKobo(spend)} logged` : "spend not logged",
      totals.clicks !== undefined ? `${totals.clicks} clicks` : "clicks not logged",
      totals.signups !== undefined ? `${totals.signups} sign-ups` : "sign-ups not logged",
    ];
    lines.push(`- ${c.name} (${CHANNEL_LABEL[c.channel]}, ${CAMPAIGN_STATUS_LABEL[c.status].toLowerCase()}): ${parts.join(", ")}.`);
  }
  const over = budgetLines(campaigns, results).filter((l) => l.over);
  lines.push("", over.length > 0 ? `Over budget: ${over.length} campaign${over.length === 1 ? "" : "s"}. Reasons to be added below.` : "No campaign is over its approved budget.");
  lines.push(input.signups === null ? "New accounts this month: not available from the console just now." : `New accounts in the weeks that start in this month (all sources): ${input.signups}.`);
  lines.push("", "What worked:", "", "What did not:", "", "Next month:");
  return lines.join("\n");
}
