import type { StaffPosition } from "@/lib/admin/staff-positions";

import { isWeekStart, type WeekInfo } from "./week";

/**
 * THE WEEKLY REPORT: SHAPES, LIMITS AND RULES. Client safe (data and pure
 * functions only) so the page, the form and the actions read one rulebook.
 *
 * The report is structured, not one blob: what was done, the numbers (some
 * counted by the desks, some typed), blockers, next week's plan, and proof.
 * Numbers carry a `source` so a reader can tell what the system counted from
 * what the person typed.
 */

export const REPORT_STATUSES = ["draft", "submitted", "reviewed", "reopened"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && (REPORT_STATUSES as readonly string[]).includes(value);
}

export const LIMITS = {
  accomplishments: 5000,
  blockers: 3000,
  nextWeek: 3000,
  reviewNote: 2000,
  numberRows: 30,
  label: 80,
  caption: 200,
  proofs: 20,
  url: 2000,
  numberMax: 1_000_000_000,
} as const;

export type NumberRow = {
  label: string;
  value: number;
  target: number | null;
  /** `desk` was counted by the system and prefilled; `typed` was written by the person. */
  source: "desk" | "typed";
  /** For a `desk` row: the count the system gave when the row was prefilled, kept so an edit is visible. */
  deskValue: number | null;
};

export type Proof = {
  id: string;
  kind: "link" | "file";
  /** A link proof's address. Always https. */
  url: string | null;
  /** A file proof's storage path in the private bucket. */
  path: string | null;
  caption: string;
  /** The file's original name, for display. */
  name: string | null;
  contentType: string | null;
};

export type WeeklyReport = {
  id: string;
  authorId: string | null;
  position: string | null;
  weekStart: string;
  status: ReportStatus;
  accomplishments: string;
  numbers: NumberRow[];
  blockers: string;
  nextWeek: string;
  proofs: Proof[];
  submittedAt: string | null;
  isLate: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  reopened: "Reopened",
};

/** What the person may do, by status. A missing report behaves as a draft that does not exist yet. */
export function canEdit(status: ReportStatus | null): boolean {
  return status === null || status === "draft" || status === "submitted" || status === "reopened";
}
export function canSubmit(status: ReportStatus | null): boolean {
  return status === null || status === "draft" || status === "reopened";
}
/** A proof can be removed only while the report is still being written. */
export function canRemoveProof(status: ReportStatus | null): boolean {
  return status === null || status === "draft" || status === "reopened";
}

export type Reviewer = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  position: StaffPosition | null;
};
/** A reviewer is an admin, a super admin or the COO position. */
export function canReview(who: Reviewer): boolean {
  return who.isAdmin || who.isSuperAdmin || who.position === "coo";
}

/** Where a person is in this week's cycle, for the page and the banner alike. */
export type WeeklyState = "opens-saturday" | "open" | "overdue" | "submitted" | "reviewed";

/**
 * `implicit` is true when the person did not pick a week: the report they are
 * shown is the latest one that opened. Once that one is in (submitted or
 * reviewed) and its due time has passed, there is nothing left to do until
 * the next Saturday, so the state is `opens-saturday`.
 */
export function weeklyState(
  week: Pick<WeekInfo, "dueAt">,
  status: ReportStatus | null,
  now: Date,
  implicit: boolean,
): WeeklyState {
  const past = now.getTime() > new Date(week.dueAt).getTime();
  if (status === "reviewed" || status === "submitted") {
    if (implicit && past) return "opens-saturday";
    return status;
  }
  return past ? "overdue" : "open";
}

/** What each part of the form asks, shown on the form and, before Saturday, as the preview. */
export const FORM_HELP = {
  accomplishments: {
    title: "What I achieved this week",
    help: "Write what you finished, against the targets you were given. Plain sentences are fine.",
  },
  numbers: {
    title: "My numbers",
    help: "A row per figure: what it is, the number, and the target if you have one. Rows marked as prefilled from the desk were counted for you; you can change them, and the original count stays visible.",
  },
  blockers: {
    title: "Blockers and what I need",
    help: "What got in the way, and what you need from someone to move on.",
  },
  nextWeek: {
    title: "Next week's plan",
    help: "What you will do next week, in order of importance.",
  },
  proofs: {
    title: "Proof",
    help: "Screenshots, links and files that show the work: a link to a live post, a screenshot of a signed agreement, a PDF of a report.",
  },
} as const;

export type ContentInput = {
  week: string;
  accomplishments: string;
  numbers: unknown;
  blockers: string;
  nextWeek: string;
};

export type ContentValue = {
  weekStart: string;
  accomplishments: string;
  numbers: NumberRow[];
  blockers: string;
  nextWeek: string;
};

type Problem = { error: string; fieldErrors?: Record<string, string> };

function text(value: unknown, max: number, field: string, label: string): { value: string } | Problem {
  if (value === undefined || value === null) return { value: "" };
  if (typeof value !== "string") return { error: `${label} is not valid.`, fieldErrors: { [field]: "Check this." } };
  const trimmed = value.trim();
  if (trimmed.length > max) return { error: `${label} is too long. Keep it under ${max} characters.`, fieldErrors: { [field]: "Shorten this." } };
  return { value: trimmed };
}

function amount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > LIMITS.numberMax) return null;
  return Math.round(value * 100) / 100;
}

export function parseNumberRows(raw: unknown): { value: NumberRow[] } | Problem {
  if (raw === undefined || raw === null) return { value: [] };
  if (!Array.isArray(raw)) return { error: "The numbers are not valid.", fieldErrors: { numbers: "Check the rows." } };
  if (raw.length > LIMITS.numberRows) return { error: `Keep it to ${LIMITS.numberRows} rows of numbers.`, fieldErrors: { numbers: "Too many rows." } };
  const rows: NumberRow[] = [];
  for (const [index, entry] of raw.entries()) {
    const r = (entry ?? {}) as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (label.length === 0 || label.length > LIMITS.label) {
      return { error: `Row ${index + 1}: give it a name of up to ${LIMITS.label} characters.`, fieldErrors: { numbers: `Row ${index + 1} needs a name.` } };
    }
    const value = amount(r.value);
    if (value === null) {
      return { error: `Row ${index + 1}: enter a number from 0 to ${LIMITS.numberMax.toLocaleString("en")}.`, fieldErrors: { numbers: `Row ${index + 1} needs a number.` } };
    }
    let target: number | null = null;
    if (r.target !== null && r.target !== undefined) {
      target = amount(r.target);
      if (target === null) {
        return { error: `Row ${index + 1}: the target must be a number, or left empty.`, fieldErrors: { numbers: `Row ${index + 1} has a bad target.` } };
      }
    }
    const source = r.source === "desk" ? "desk" : "typed";
    const deskValue = source === "desk" ? amount(r.deskValue) : null;
    rows.push({ label, value, target, source, deskValue });
  }
  return { value: rows };
}

/** Validate what the person typed. Nothing is written before this passes. */
export function validateContent(input: ContentInput): { value: ContentValue } | Problem {
  if (!isWeekStart(input?.week)) return { error: "Choose a valid week." };
  const accomplishments = text(input.accomplishments, LIMITS.accomplishments, "accomplishments", "What you achieved");
  if ("error" in accomplishments) return accomplishments;
  const blockers = text(input.blockers, LIMITS.blockers, "blockers", "Blockers");
  if ("error" in blockers) return blockers;
  const nextWeek = text(input.nextWeek, LIMITS.nextWeek, "nextWeek", "Next week's plan");
  if ("error" in nextWeek) return nextWeek;
  const numbers = parseNumberRows(input.numbers);
  if ("error" in numbers) return numbers;
  return {
    value: {
      weekStart: input.week,
      accomplishments: accomplishments.value,
      numbers: numbers.value,
      blockers: blockers.value,
      nextWeek: nextWeek.value,
    },
  };
}

/** Submitting needs at least the account of what was achieved. */
export function submitProblem(content: Pick<ContentValue, "accomplishments">): Problem | null {
  if (content.accomplishments.length < 10) {
    return { error: "Write what you achieved this week before you submit.", fieldErrors: { accomplishments: "Say what you achieved." } };
  }
  return null;
}

// ---------- proof ----------

export const BUCKET = "staff-report-proofs";
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // matches lib/admin/social-media/actions.ts
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

/** Null when the file may be uploaded, else the sentence to show. */
export function fileProblem(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return "That file type is not supported. Use an image (JPEG, PNG, WebP, GIF), a PDF, or a short video (MP4, MOV, WebM).";
  }
  if (file.size <= 0) return "That file is empty.";
  const video = file.type.startsWith("video/");
  if (file.size > (video ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES)) {
    return video ? "That video is over 100MB. Export it at a lower resolution and try again." : "That file is over 10MB. Use a smaller file and try again.";
  }
  return null;
}

/** Only an https link, with no embedded login, is kept as proof. */
export function parseProofLink(raw: unknown): { url: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Paste a link." };
  const value = raw.trim();
  if (value.length === 0) return { error: "Paste a link." };
  if (value.length > LIMITS.url) return { error: "That link is too long." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: "That does not look like a link." };
  }
  if (url.protocol !== "https:") return { error: "Use a link that starts with https://." };
  if (url.username || url.password) return { error: "Leave the login out of the link." };
  if (!url.hostname.includes(".")) return { error: "That does not look like a link." };
  return { url: url.toString() };
}

export function parseCaption(raw: unknown): { caption: string } | { error: string } {
  if (raw === undefined || raw === null) return { caption: "" };
  if (typeof raw !== "string") return { error: "The caption is not valid." };
  const caption = raw.trim();
  if (caption.length > LIMITS.caption) return { error: `Keep the caption under ${LIMITS.caption} characters.` };
  return { caption };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const UUID_RE = new RegExp(`^${UUID}$`, "i");

/** A storage path is `<author id>/<week start>/<file name>`; this is the only shape the bucket gets. */
export function proofPath(authorId: string, weekStart: string, fileName: string): string {
  return `${authorId}/${weekStart}/${fileName}`;
}

/** True when the path is inside this author's own folder of the bucket, in the one shape uploads use. */
export function isOwnProofPath(path: unknown, authorId: string): path is string {
  if (typeof path !== "string" || !UUID_RE.test(authorId)) return false;
  const m = new RegExp(`^(${UUID})/(\\d{4}-\\d{2}-\\d{2})/([A-Za-z0-9][A-Za-z0-9._-]{0,80})$`, "i").exec(path);
  if (!m) return false;
  return m[1]!.toLowerCase() === authorId.toLowerCase() && isWeekStart(m[2]) && !path.includes("..");
}

/** Read the stored proofs back, dropping anything that is not a valid https link or an own-bucket path. */
export function sanitizeProofs(raw: unknown, authorId: string | null): Proof[] {
  if (!Array.isArray(raw)) return [];
  const out: Proof[] = [];
  for (const entry of raw) {
    const p = (entry ?? {}) as Record<string, unknown>;
    const id = typeof p.id === "string" && /^[A-Za-z0-9_-]{4,40}$/.test(p.id) ? p.id : null;
    if (!id) continue;
    const caption = typeof p.caption === "string" ? p.caption.slice(0, LIMITS.caption) : "";
    if (p.kind === "link") {
      const link = parseProofLink(p.url);
      if ("error" in link) continue;
      out.push({ id, kind: "link", url: link.url, path: null, caption, name: null, contentType: null });
    } else if (p.kind === "file") {
      if (!authorId || !isOwnProofPath(p.path, authorId)) continue;
      out.push({
        id,
        kind: "file",
        url: null,
        path: p.path,
        caption,
        name: typeof p.name === "string" ? p.name.slice(0, 120) : null,
        contentType: typeof p.contentType === "string" ? p.contentType : null,
      });
    }
  }
  return out.slice(0, LIMITS.proofs);
}

// ---------- reviewer view ----------

export type RosterStatus = "not-started" | "draft" | "reopened" | "submitted" | "reviewed";

export function rosterStatus(report: Pick<WeeklyReport, "status"> | null): RosterStatus {
  return report ? report.status : "not-started";
}

export const ROSTER_LABEL: Record<RosterStatus, string> = {
  "not-started": "Not started",
  draft: "Draft",
  reopened: "Reopened",
  submitted: "Submitted",
  reviewed: "Reviewed",
};

export type RosterSummary = { people: number; submitted: number; late: number; reviewed: number };

/** "Submitted n of m, late n": submitted counts a report that is submitted or already reviewed. */
export function summarise(rows: readonly { report: Pick<WeeklyReport, "status" | "isLate"> | null }[]): RosterSummary {
  let submitted = 0;
  let late = 0;
  let reviewed = 0;
  for (const { report } of rows) {
    if (!report) continue;
    if (report.status === "submitted" || report.status === "reviewed") {
      submitted += 1;
      if (report.isLate) late += 1;
    }
    if (report.status === "reviewed") reviewed += 1;
  }
  return { people: rows.length, submitted, late, reviewed };
}

// ---------- CSV ----------

/** One cell. A leading = + - @ would run as a formula in a spreadsheet, so it is defused with a quote. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export type CsvRow = { name: string; roleLabel: string; report: WeeklyReport | null };

export function weekCsv(rows: readonly CsvRow[]): string {
  const head = ["Name", "Position", "Status", "Late", "Submitted at", "Achievements", "Numbers", "Blockers", "Next week", "Proofs", "Review note"];
  const lines = [head.map(csvCell).join(",")];
  for (const { name, roleLabel, report } of rows) {
    const numbers = report?.numbers
      .map((n) => `${n.label}: ${n.value}${n.target !== null ? ` of ${n.target}` : ""}${n.source === "desk" ? " (desk count)" : ""}`)
      .join("; ");
    const proofs = report?.proofs.map((p) => (p.kind === "link" ? p.url : `file: ${p.name ?? p.path}`)).join("; ");
    lines.push(
      [
        name,
        roleLabel,
        ROSTER_LABEL[rosterStatus(report)],
        report ? (report.isLate ? "Yes" : "No") : "",
        report?.submittedAt ?? "",
        report?.accomplishments ?? "",
        numbers ?? "",
        report?.blockers ?? "",
        report?.nextWeek ?? "",
        proofs ?? "",
        report?.reviewNote ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
