import { isUuid, lagosToday, median, trimmed } from "@/lib/admin/desk-rules";

/**
 * THE CUSTOMER SUPPORT LEAD'S SHAPES (founder, 10 November 2026): quality
 * reviews of answered tickets, support policy notes, and the team figures the
 * console can count from the support queue. Pure and client-safe. A review
 * names a ticket by its reference only; no message text is ever copied here.
 */

export const SCORE_KEYS = ["tone", "accuracy", "speed", "policy"] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];
export const SCORE_LABEL: Record<ScoreKey, string> = { tone: "Tone", accuracy: "Accuracy", speed: "Speed", policy: "Policy" };
export const SCORE_HELP: Record<ScoreKey, string> = {
  tone: "Warm, plain, respectful, no blame.",
  accuracy: "What it said was right and complete.",
  speed: "Answered inside the promised time.",
  policy: "Followed the approved policy and house money wording.",
};

export type QaReview = {
  id: string;
  ticketRef: string;
  reviewedAgent: string | null;
  reviewerId: string | null;
  tone: number;
  accuracy: number;
  speed: number;
  policy: number;
  notes: string;
  createdAt: string;
};

export type QaInput = { ticketRef: string; agentId: string; tone: string; accuracy: string; speed: string; policy: string; notes: string };
export type ParsedQa =
  | { value: { ticket_ref: string; reviewed_agent: string; tone: number; accuracy: number; speed: number; policy: number; notes: string } }
  | { error: string; fieldErrors: Record<string, string> };

const score = (v: string): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

export function parseQa(input: QaInput): ParsedQa {
  const fieldErrors: Record<string, string> = {};
  const ticketRef = trimmed(input.ticketRef, 64).toUpperCase();
  if (!ticketRef) fieldErrors.ticketRef = "Enter the ticket reference.";
  if (!isUuid(input.agentId)) fieldErrors.agentId = "Choose the agent whose answer you reviewed.";
  const scores = {} as Record<ScoreKey, number>;
  for (const key of SCORE_KEYS) {
    const n = score(input[key]);
    if (n === null) fieldErrors[key] = "Score from 1 to 5.";
    else scores[key] = n;
  }
  const notes = trimmed(input.notes, 2000);
  if (Object.keys(fieldErrors).length > 0) return { error: "Check the highlighted fields and try again.", fieldErrors };
  return { value: { ticket_ref: ticketRef, reviewed_agent: input.agentId, ...scores, notes } };
}

export type AgentQuality = { agentId: string; reviews: number; tone: number; accuracy: number; speed: number; policy: number; overall: number; lowest: ScoreKey };

const avg = (xs: number[]) => Math.round((xs.reduce((t, n) => t + n, 0) / xs.length) * 10) / 10;

/** Average scores per agent over the reviews given, newest-agnostic. An agent with no review is absent, not zero. */
export function qualityByAgent(reviews: readonly QaReview[]): AgentQuality[] {
  const by = new Map<string, QaReview[]>();
  for (const r of reviews) {
    if (!r.reviewedAgent) continue;
    by.set(r.reviewedAgent, [...(by.get(r.reviewedAgent) ?? []), r]);
  }
  return [...by.entries()]
    .map(([agentId, list]) => {
      const means = Object.fromEntries(SCORE_KEYS.map((k) => [k, avg(list.map((r) => r[k]))])) as Record<ScoreKey, number>;
      const lowest = SCORE_KEYS.reduce((a, b) => (means[b] < means[a] ? b : a), SCORE_KEYS[0]);
      return { agentId, reviews: list.length, ...means, overall: avg(SCORE_KEYS.map((k) => means[k])), lowest };
    })
    .sort((a, b) => a.overall - b.overall);
}

/** Reviews in the Monday-start week holding `today`. */
export function reviewsThisWeek(reviews: readonly QaReview[], now: number = Date.now()): number {
  const since = now - 7 * 86_400_000;
  return reviews.filter((r) => Date.parse(r.createdAt) >= since).length;
}

/* ------------------------------------------------------------- policy notes */

export const POLICY_STATUSES = ["draft", "approved", "retired"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];
export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = { draft: "Draft, waiting for approval", approved: "Approved", retired: "Retired" };
export const isPolicyStatus = (v: unknown): v is PolicyStatus => typeof v === "string" && (POLICY_STATUSES as readonly string[]).includes(v);

export type PolicyNote = {
  id: string;
  title: string;
  body: string;
  status: PolicyStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PolicyInput = { title: string; body: string };
export type ParsedPolicy = { value: { title: string; body: string } } | { error: string; fieldErrors: Record<string, string> };

export function parsePolicy(input: PolicyInput): ParsedPolicy {
  const fieldErrors: Record<string, string> = {};
  const title = trimmed(input.title, 160);
  if (!title) fieldErrors.title = "Give the note a title.";
  const body = (input.body ?? "").trim();
  if (!body) fieldErrors.body = "Write the policy.";
  if (body.length > 8000) fieldErrors.body = "That is too long. Split it in two.";
  if (Object.keys(fieldErrors).length > 0) return { error: "Check the highlighted fields and try again.", fieldErrors };
  return { value: { title, body } };
}

/* ------------------------------------------------------------ team figures */

export type TeamRow = {
  id: string;
  reference: string;
  topic: string | null;
  lane: string;
  breached: boolean;
  slaLabel: string;
  holder: string | null;
  holderIsMe: boolean;
  escalated: boolean;
  createdAt: string;
  lastActivityAt: string;
};

export type Workload = {
  open: number;
  unassigned: number;
  late: number;
  escalated: number;
  oldestOpenHours: number | null;
  byHolder: { name: string; open: number; late: number }[];
};

/** The team's load from the queue rows (open lanes only). Done tickets never count. */
export function workload(rows: readonly TeamRow[], now: number = Date.now()): Workload {
  const open = rows.filter((r) => r.lane !== "done");
  const held = new Map<string, { open: number; late: number }>();
  for (const r of open) {
    if (!r.holder) continue;
    const prev = held.get(r.holder) ?? { open: 0, late: 0 };
    held.set(r.holder, { open: prev.open + 1, late: prev.late + (r.breached ? 1 : 0) });
  }
  const oldest = open.length ? Math.max(...open.map((r) => now - Date.parse(r.createdAt))) : null;
  return {
    open: open.length,
    unassigned: open.filter((r) => !r.holder && r.lane !== "waiting_on_member").length,
    late: open.filter((r) => r.breached).length,
    escalated: open.filter((r) => r.escalated).length,
    oldestOpenHours: oldest === null ? null : Math.floor(oldest / 3_600_000),
    byHolder: [...held.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.open - a.open),
  };
}

/** The most common topics among tickets, with a share, for the repeated-issue tracker. */
export function topTopics(topics: readonly (string | null)[], limit = 8): { topic: string; count: number; share: number }[] {
  const counts = new Map<string, number>();
  for (const raw of topics) {
    const t = (raw ?? "").trim().toLowerCase() || "not stated";
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const total = topics.length;
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count, share: total === 0 ? 0 : Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, limit);
}

/** How long answered tickets took to finish, from the done rows the queue holds: median hours, or null when there are none. */
export function medianHoursToFinish(rows: readonly { createdAt: string; lastActivityAt: string }[]): number | null {
  const hours = rows.map((r) => (Date.parse(r.lastActivityAt) - Date.parse(r.createdAt)) / 3_600_000).filter((h) => Number.isFinite(h) && h >= 0);
  const m = median(hours);
  return m === null ? null : Math.round(m * 10) / 10;
}

export function todayLabel(now: number = Date.now()): string {
  return lagosToday(now);
}
