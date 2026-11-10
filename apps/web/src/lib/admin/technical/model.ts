import { addDays, lagosToday, median, trimmed } from "@/lib/admin/desk-rules";

/**
 * THE TECHNICAL DESK'S SHAPES (founder, 10 November 2026). A read-only view of
 * how the platform is doing, and the record of technical incidents. Nothing
 * here shows, asks for or stores a key, a password, a database credential or
 * a secret, and nothing here can change infrastructure. Pure and client-safe.
 */

export const SEVERITIES = ["sev1", "sev2", "sev3", "sev4"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_LABEL: Record<Severity, string> = {
  sev1: "Severity 1: members cannot use Vallo, or money or data is at risk",
  sev2: "Severity 2: a main journey is broken for many",
  sev3: "Severity 3: a feature is degraded or broken for some",
  sev4: "Severity 4: minor, with a workaround",
};
export const SEVERITY_SHORT: Record<Severity, string> = { sev1: "Sev 1", sev2: "Sev 2", sev3: "Sev 3", sev4: "Sev 4" };

export const INCIDENT_STATUSES = ["open", "investigating", "mitigated", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  mitigated: "Mitigated",
  resolved: "Resolved",
};

export const isSeverity = (v: unknown): v is Severity => typeof v === "string" && (SEVERITIES as readonly string[]).includes(v);
export const isIncidentStatus = (v: unknown): v is IncidentStatus => typeof v === "string" && (INCIDENT_STATUSES as readonly string[]).includes(v);

export type Incident = {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  summary: string;
  resolutionSummary: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentUpdate = {
  id: string;
  incidentId: string;
  body: string;
  statusAfter: IncidentStatus | null;
  authorId: string | null;
  createdAt: string;
};

/** The words that must never be written into an incident: a secret has no place in a log everyone reads. */
const SECRET_SHAPES: RegExp[] = [
  /\bsk_(live|test)_[A-Za-z0-9]{8,}/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(api[_ -]?key|secret|password|passwd|token|service[_ -]?role)\b\s*[:=]\s*\S{6,}/i,
  /\bpostgres(ql)?:\/\/\S+:\S+@/i,
];

/** True when the text looks like it carries a key, token, password or connection string. */
export function looksLikeSecret(text: string): boolean {
  return SECRET_SHAPES.some((re) => re.test(text));
}
export const SECRET_REFUSAL = "That looks like it contains a key, token or password. Take it out: describe what you saw instead. If a real key may have leaked, tell the COO now.";

/** Where an incident may go next. Resolving needs a written summary (the action checks); a resolved one can be reopened. */
const MOVES: Record<IncidentStatus, readonly IncidentStatus[]> = {
  open: ["investigating", "mitigated", "resolved"],
  investigating: ["open", "mitigated", "resolved"],
  mitigated: ["investigating", "resolved"],
  resolved: ["investigating"],
};
export function canMoveIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return MOVES[from].includes(to);
}
export function nextIncidentStatuses(from: IncidentStatus): readonly IncidentStatus[] {
  return MOVES[from];
}

export type IncidentInput = { title: string; severity: string; summary: string };
export type ParsedIncident = { value: { title: string; severity: Severity; summary: string } } | { error: string; fieldErrors: Record<string, string> };

export function parseIncident(input: IncidentInput): ParsedIncident {
  const fieldErrors: Record<string, string> = {};
  const title = trimmed(input.title, 200);
  if (!title) fieldErrors.title = "Give the incident a short title.";
  if (!isSeverity(input.severity)) fieldErrors.severity = "Choose a severity.";
  const summary = trimmed(input.summary, 4000);
  if (looksLikeSecret(`${title}\n${summary}`)) fieldErrors.summary = SECRET_REFUSAL;
  if (Object.keys(fieldErrors).length > 0) return { error: "Check the highlighted fields and try again.", fieldErrors };
  return { value: { title, severity: input.severity as Severity, summary } };
}

export function parseUpdateBody(body: string): { value: string } | { error: string } {
  const text = trimmed(body, 4000);
  if (!text) return { error: "Write what changed." };
  if (looksLikeSecret(text)) return { error: SECRET_REFUSAL };
  return { value: text };
}

export type IncidentSummary = { open: number; sev1or2Open: number; resolvedThisMonth: number; medianHoursToResolve: number | null };

export function summariseIncidents(incidents: readonly Incident[], now: number = Date.now()): IncidentSummary {
  const month = lagosToday(now).slice(0, 7);
  const open = incidents.filter((i) => i.status !== "resolved");
  const resolved = incidents.filter((i) => i.status === "resolved" && i.resolvedAt);
  const hours = resolved
    .filter((i) => (i.resolvedAt ?? "").slice(0, 7) === month || now - Date.parse(i.resolvedAt!) < 30 * 86_400_000)
    .map((i) => (Date.parse(i.resolvedAt!) - Date.parse(i.startedAt)) / 3_600_000)
    .filter((h) => Number.isFinite(h) && h >= 0);
  const m = median(hours);
  return {
    open: open.length,
    sev1or2Open: open.filter((i) => i.severity === "sev1" || i.severity === "sev2").length,
    resolvedThisMonth: resolved.filter((i) => (i.resolvedAt ?? "").startsWith(month)).length,
    medianHoursToResolve: m === null ? null : Math.round(m * 10) / 10,
  };
}

/* -------------------------------------------------------------- job health */

export type JobRun = { job: string; outcome: "ok" | "attention" | "failed"; at: string };
export type JobSpec = { name: string; schedule: string; maxGapHours: number };
export type JobState = "on_time" | "late" | "failing" | "no_run_seen";
export type JobHealth = { name: string; schedule: string; state: JobState; lastAt: string | null; lastOutcome: JobRun["outcome"] | null; ok: number; attention: number; failed: number };

/** Each job's newest run, its state against its allowed gap, and its outcomes over the runs given. */
export function jobHealth(specs: readonly JobSpec[], runs: readonly JobRun[], now: number = Date.now()): JobHealth[] {
  return specs.map((spec) => {
    const mine = runs.filter((r) => r.job === spec.name).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const last = mine[0] ?? null;
    let state: JobState = "no_run_seen";
    if (last) {
      if (last.outcome === "failed") state = "failing";
      else if (now - Date.parse(last.at) > spec.maxGapHours * 3_600_000) state = "late";
      else state = "on_time";
    }
    return {
      name: spec.name,
      schedule: spec.schedule,
      state,
      lastAt: last?.at ?? null,
      lastOutcome: last?.outcome ?? null,
      ok: mine.filter((r) => r.outcome === "ok").length,
      attention: mine.filter((r) => r.outcome === "attention").length,
      failed: mine.filter((r) => r.outcome === "failed").length,
    };
  });
}

export const JOB_STATE_LABEL: Record<JobState, string> = { on_time: "On time", late: "Late", failing: "Last run failed", no_run_seen: "No run seen" };

/** Parses `cron.<job>.<ok|attention|failed>` from an audit action. */
export function parseCronAction(action: string): { job: string; outcome: JobRun["outcome"] } | null {
  const m = /^cron\.(.+)\.(ok|attention|failed)$/.exec(action);
  return m ? { job: m[1]!, outcome: m[2] as JobRun["outcome"] } : null;
}

/* ------------------------------------------------------------- error trends */

export type DayCount = { day: string; count: number };

/** Counts per Lagos day for the last `days` days ending today, oldest first. */
export function dailyCounts(stamps: readonly string[], days: number, today: string = lagosToday()): DayCount[] {
  const list = Array.from({ length: days }, (_, i) => addDays(today, -(days - 1 - i)));
  const counts = new Map(list.map((d) => [d, 0]));
  for (const s of stamps) {
    const day = lagosToday(Date.parse(s));
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return list.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

/** This week's total against last week's, as a plain sentence the desk can print; null when there is nothing to compare. */
export function trendWords(series: readonly DayCount[]): string | null {
  if (series.length < 14) return null;
  const recent = series.slice(-7).reduce((t, d) => t + d.count, 0);
  const before = series.slice(-14, -7).reduce((t, d) => t + d.count, 0);
  if (recent === 0 && before === 0) return "No errors recorded in either of the last two weeks.";
  if (before === 0) return `${recent} in the last seven days, none the seven before.`;
  const change = Math.round(((recent - before) / before) * 100);
  if (change === 0) return `${recent} in the last seven days, the same as the seven before.`;
  return `${recent} in the last seven days, ${Math.abs(change)}% ${change > 0 ? "more" : "fewer"} than the seven before (${before}).`;
}

export type DeploymentInfo = { environment: string; release: string | null; runtime: string };

/** What the console may say about what is running: the environment and the short release code. Nothing else. */
export function deploymentInfo(env: { VERCEL_ENV?: string | undefined; VERCEL_GIT_COMMIT_SHA?: string | undefined; NODE_ENV?: string | undefined }): DeploymentInfo {
  const sha = (env.VERCEL_GIT_COMMIT_SHA ?? "").trim();
  return {
    environment: env.VERCEL_ENV ? env.VERCEL_ENV : env.NODE_ENV === "production" ? "production" : "development",
    release: /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7) : null,
    runtime: env.NODE_ENV ?? "unknown",
  };
}
