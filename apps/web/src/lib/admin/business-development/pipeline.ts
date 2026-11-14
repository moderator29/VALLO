import { BD_CATEGORY_LABEL, BD_STAGE_LABEL, type BdActivity, type BdProspect, type BdStage } from "./types";

/**
 * The pipeline table's own arithmetic: search, filter, order, follow-up
 * state and the spreadsheet export. Pure, so the table (a client component)
 * and the tests share it.
 */

/** A prospect that is still being worked: neither onboarded nor rejected. */
export function isOpenStage(stage: BdStage): boolean {
  return stage !== "onboarded" && stage !== "rejected";
}

export type FollowUpState = "overdue" | "today" | "soon" | "later" | "none";

/** Today's date in Lagos as YYYY-MM-DD: the pipeline's dates are Lagos calendar days. */
export function lagosToday(now: number = Date.now()): string {
  return new Date(now + 3_600_000).toISOString().slice(0, 10);
}

/** Where a follow-up date stands against today. A closed prospect is never due. */
export function followUpState(prospect: Pick<BdProspect, "nextFollowUpAt" | "stage">, today: string): FollowUpState {
  if (!prospect.nextFollowUpAt || !isOpenStage(prospect.stage)) return "none";
  if (prospect.nextFollowUpAt < today) return "overdue";
  if (prospect.nextFollowUpAt === today) return "today";
  const days = (Date.parse(`${prospect.nextFollowUpAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= 7 ? "soon" : "later";
}

export const FOLLOW_UP_WORD: Record<FollowUpState, string> = {
  overdue: "Overdue",
  today: "Today",
  soon: "This week",
  later: "Later",
  none: "Not set",
};

/** Each prospect's most recent activity row. The log arrives newest first. */
export function lastActivityByProspect(activity: readonly BdActivity[]): Map<string, BdActivity> {
  const last = new Map<string, BdActivity>();
  for (const row of activity) {
    const held = last.get(row.prospectId);
    if (!held || row.createdAt > held.createdAt) last.set(row.prospectId, row);
  }
  return last;
}

/** Every activity row of every prospect, newest first within each. */
export function activityByProspect(activity: readonly BdActivity[]): Map<string, BdActivity[]> {
  const grouped = new Map<string, BdActivity[]>();
  for (const row of activity) {
    const rows = grouped.get(row.prospectId);
    if (rows) rows.push(row);
    else grouped.set(row.prospectId, [row]);
  }
  for (const rows of grouped.values()) rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return grouped;
}

export type PipelineView = "open" | "all" | BdStage;
export type PipelineFilter = { query: string; view: PipelineView; category: string };

function normal(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

/** Digits only, so "0803 123 4567" finds "+2348031234567" and the reverse. */
function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function matchesQuery(prospect: BdProspect, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [prospect.businessName, prospect.contactName, prospect.email, prospect.location, prospect.notes]
    .map(normal)
    .join("\n");
  if (text.includes(q)) return true;
  const qDigits = digits(q);
  if (qDigits.length < 4) return false;
  const phone = digits(prospect.phone);
  /* A number typed the local way (0803...) finds one stored the international way (+234803...), and the reverse. */
  return [qDigits, qDigits.replace(/^0/, ""), qDigits.replace(/^234/, "")].some((q2) => q2.length >= 4 && phone.includes(q2));
}

export function filterPipeline(prospects: readonly BdProspect[], filter: PipelineFilter): BdProspect[] {
  return prospects.filter((p) => {
    if (filter.view === "open" ? !isOpenStage(p.stage) : filter.view !== "all" && p.stage !== filter.view) return false;
    if (filter.category !== "all" && p.category !== filter.category) return false;
    return matchesQuery(p, filter.query);
  });
}

/**
 * The working order: whatever is due first (overdue, then today, then by
 * date), then the prospects with no date, newest first. A closed prospect
 * goes last.
 */
export function orderPipeline(prospects: readonly BdProspect[]): BdProspect[] {
  const rank = (p: BdProspect): number => (!isOpenStage(p.stage) ? 2 : p.nextFollowUpAt ? 0 : 1);
  return [...prospects].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (rank(a) === 0) {
      const byDate = (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? "");
      if (byDate !== 0) return byDate;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** How many prospects stand at each stage, plus the open and whole totals. */
export function stageCounts(prospects: readonly BdProspect[]): Record<PipelineView, number> {
  const counts = { open: 0, all: prospects.length } as Record<PipelineView, number>;
  for (const stage of Object.keys(BD_STAGE_LABEL) as BdStage[]) counts[stage] = 0;
  for (const p of prospects) {
    counts[p.stage] += 1;
    if (isOpenStage(p.stage)) counts.open += 1;
  }
  return counts;
}

/**
 * One spreadsheet cell. A value that begins with =, +, - or @ is read by a
 * spreadsheet as a formula, so it is written with a leading apostrophe.
 */
function cell(value: string | null | undefined): string {
  const raw = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The pipeline as a CSV a spreadsheet opens: one row per prospect, as shown. */
export function pipelineCsv(prospects: readonly BdProspect[], activity: readonly BdActivity[]): string {
  const last = lastActivityByProspect(activity);
  const head = [
    "Business",
    "Contact",
    "Category",
    "Email",
    "Phone",
    "Location",
    "Stage",
    "Next follow-up",
    "Last activity",
    "Last activity date",
    "Onboarded",
    "Listing linked",
    "Added",
    "Notes",
  ];
  const rows = prospects.map((p) => {
    const recent = last.get(p.id);
    return [
      p.businessName,
      p.contactName,
      BD_CATEGORY_LABEL[p.category],
      p.email,
      p.phone,
      p.location,
      BD_STAGE_LABEL[p.stage],
      p.nextFollowUpAt,
      recent ? (recent.outcome ? `${recent.body} (${recent.outcome})` : recent.body) : "",
      recent ? recent.createdAt.slice(0, 10) : "",
      p.onboardedAt ? p.onboardedAt.slice(0, 10) : "",
      p.listingId ? "Yes" : "No",
      p.createdAt.slice(0, 10),
      p.notes,
    ]
      .map(cell)
      .join(",");
  });
  return [head.join(","), ...rows].join("\r\n");
}
