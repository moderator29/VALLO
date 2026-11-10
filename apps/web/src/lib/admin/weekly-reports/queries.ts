import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listAllActivity, listPipeline } from "@/lib/admin/business-development/reads";
import { readMyTasks } from "@/lib/admin/my-desk/queries";
import { isStaffPosition, type StaffPosition } from "@/lib/admin/staff-positions";
import { readSocialPosts } from "@/lib/admin/social-media/queries";
import { faults, isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";
import { createAdminClient } from "@/lib/supabase/admin";

import { BUCKET, isReportStatus, parseNumberRows, sanitizeProofs, type NumberRow, type Proof, type WeeklyReport } from "./model";
import { bdRows, contentRows, marketingRows, socialRows, supportLeadRows, taskRows, technicalRows } from "./prefill";
import { readContentItems } from "@/lib/admin/content/queries";
import { readEntries } from "@/lib/admin/desk-entries/queries";
import { readCampaigns, readResults } from "@/lib/admin/marketing/queries";
import { readPolicyNotes, readQaReviews } from "@/lib/admin/support-lead/queries";
import { readIncidents } from "@/lib/admin/technical/queries";

export type Read<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "error" };

type Row = {
  id: string;
  author_id: string | null;
  position: string | null;
  week_start: string;
  status: string;
  accomplishments: string | null;
  numbers: unknown;
  blockers: string | null;
  next_week: string | null;
  proofs: unknown;
  submitted_at: string | null;
  is_late: boolean | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export const REPORT_SELECT =
  "id, author_id, position, week_start, status, accomplishments, numbers, blockers, next_week, proofs, submitted_at, is_late, reviewed_by, reviewed_at, review_note, created_at, updated_at";

export function reportFromRow(r: Row): WeeklyReport {
  const numbers = parseNumberRows(r.numbers);
  return {
    id: r.id,
    authorId: r.author_id,
    position: r.position,
    weekStart: r.week_start,
    status: isReportStatus(r.status) ? r.status : "draft",
    accomplishments: r.accomplishments ?? "",
    numbers: "value" in numbers ? numbers.value : [],
    blockers: r.blockers ?? "",
    nextWeek: r.next_week ?? "",
    proofs: sanitizeProofs(r.proofs, r.author_id),
    submittedAt: r.submitted_at,
    isLate: r.is_late === true,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** One person's report for one week, or null when they have not started it. */
export async function readReport(db: SupabaseClient, authorId: string, weekStart: string): Promise<Read<WeeklyReport | null>> {
  const { data, error } = await db
    .from("staff_weekly_reports")
    .select(REPORT_SELECT)
    .eq("author_id", authorId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) {
    await reportReadFault("read.admin.weekly-reports.report", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return { state: "ok", data: data ? reportFromRow(data as unknown as Row) : null };
}

/** A person's past reports, newest week first. */
export async function readHistory(db: SupabaseClient, authorId: string): Promise<Read<WeeklyReport[]>> {
  const { data, error } = await db
    .from("staff_weekly_reports")
    .select(REPORT_SELECT)
    .eq("author_id", authorId)
    .order("week_start", { ascending: false })
    .limit(104);
  if (error) {
    await reportReadFault("read.admin.weekly-reports.history", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return { state: "ok", data: ((data ?? []) as unknown as Row[]).map(reportFromRow) };
}

/** Every report filed for one week. Reviewer side. */
export async function readWeekReports(db: SupabaseClient, weekStart: string): Promise<Read<WeeklyReport[]>> {
  const { data, error } = await db
    .from("staff_weekly_reports")
    .select(REPORT_SELECT)
    .eq("week_start", weekStart)
    .limit(1000);
  if (error) {
    await reportReadFault("read.admin.weekly-reports.week", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return { state: "ok", data: ((data ?? []) as unknown as Row[]).map(reportFromRow) };
}

/** The weeks that have any report, newest first, for the reviewer's week picker. */
export async function readWeeksWithReports(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db.from("staff_weekly_reports").select("week_start").order("week_start", { ascending: false }).limit(400);
  if (error) {
    await reportReadFault("read.admin.weekly-reports.weeks", ...faults(error));
    return [];
  }
  return [...new Set(((data ?? []) as { week_start: string }[]).map((r) => r.week_start))];
}

export type RosterPerson = {
  userId: string;
  name: string;
  kind: "super_admin" | "admin" | "staff";
  position: StaffPosition | null;
};

/**
 * Everyone who can act in the console now: a live staff grant, or an admin or
 * super admin role (the people `app/admin/staff/page.tsx` lists, read-only and
 * without the super admin gate that page carries). The service client is used
 * because staff rows and other people's profiles are not the caller's own RLS
 * rows; callers reach this only after the reviewer check.
 */
export async function readRoster(): Promise<Read<RosterPerson[]>> {
  try {
    const service = createAdminClient() as unknown as SupabaseClient;
    const [grants, roles] = await Promise.all([
      service.from("staff_grants").select("user_id, position").is("revoked_at", null),
      service.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin"]),
    ]);
    if (grants.error || roles.error) {
      await reportReadFault("read.admin.weekly-reports.roster", ...faults(grants.error, roles.error));
      return { state: "error" };
    }
    const kind = new Map<string, "super_admin" | "admin">();
    for (const r of (roles.data ?? []) as { user_id: string; role: string }[]) {
      if (r.role === "super_admin" || !kind.has(r.user_id)) kind.set(r.user_id, r.role === "super_admin" ? "super_admin" : "admin");
    }
    const people = new Map<string, RosterPerson>();
    for (const g of (grants.data ?? []) as { user_id: string; position: unknown }[]) {
      people.set(g.user_id, { userId: g.user_id, name: "", kind: "staff", position: isStaffPosition(g.position) ? g.position : null });
    }
    for (const [id, k] of kind) people.set(id, { userId: id, name: "", kind: k, position: null });
    const ids = [...people.keys()];
    if (ids.length > 0) {
      const { data } = await service.from("profiles").select("id, display_name, first_name").in("id", ids);
      for (const p of (data ?? []) as { id: string; display_name: string | null; first_name: string | null }[]) {
        const person = people.get(p.id);
        if (person) person.name = (p.display_name ?? p.first_name ?? "").trim();
      }
    }
    const list = [...people.values()].map((p) => ({ ...p, name: p.name || "A member of staff" }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return { state: "ok", data: list };
  } catch {
    return { state: "error" };
  }
}

/**
 * Short signed URLs (10 minutes) for the file proofs of a report. The bucket
 * is private with no storage policy, so only the service client can sign.
 */
export async function signProofs(db: SupabaseClient, proofs: readonly Proof[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    proofs
      .filter((p) => p.kind === "file" && p.path)
      .map(async (p) => {
        try {
          const { data } = await db.storage.from(BUCKET).createSignedUrl(p.path!, 600);
          if (data?.signedUrl) out.set(p.id, data.signedUrl);
        } catch {
          /* The proof is still listed, just without a viewing link. */
        }
      }),
  );
  return out;
}

/**
 * The figures the desks can count for this person and week. Everyone gets
 * tasks completed; the Social Media Manager and the Business Development
 * Director also get their own desks' counts. A desk that cannot be read (not
 * set up, or an error) contributes no rows rather than zeros.
 */
export async function readDeskRows(db: SupabaseClient, userId: string, position: StaffPosition | null, weekStart: string): Promise<NumberRow[]> {
  const rows: NumberRow[] = [];
  try {
    if (position === "social_media_manager") {
      const posts = await readSocialPosts(db);
      if (posts.state === "ok") rows.push(...socialRows(posts.data, weekStart));
    } else if (position === "business_development_executive") {
      const [pipeline, activity] = await Promise.all([listPipeline(), listAllActivity()]);
      if (pipeline.state === "ok" && activity.state === "ok") rows.push(...bdRows(pipeline.data, activity.data, weekStart));
    } else if (position === "marketing_manager") {
      const [campaigns, results, entries] = await Promise.all([readCampaigns(db), readResults(db), readEntries(db, "marketing")]);
      if (campaigns.state === "ok" && results.state === "ok") rows.push(...marketingRows(campaigns.data, results.data, entries.state === "ok" ? entries.data : [], weekStart));
    } else if (position === "content_manager") {
      const [items, entries] = await Promise.all([readContentItems(db), readEntries(db, "content")]);
      if (items.state === "ok") rows.push(...contentRows(items.data, entries.state === "ok" ? entries.data : [], weekStart));
    } else if (position === "technical_administrator") {
      const [incidents, entries] = await Promise.all([readIncidents(db), readEntries(db, "technical")]);
      if (incidents.state === "ok") rows.push(...technicalRows(incidents.data, entries.state === "ok" ? entries.data : [], weekStart));
    } else if (position === "customer_support_lead") {
      const [reviews, policy, entries] = await Promise.all([readQaReviews(db), readPolicyNotes(db), readEntries(db, "support_lead")]);
      if (reviews.state === "ok" && policy.state === "ok") rows.push(...supportLeadRows(reviews.data, policy.data, entries.state === "ok" ? entries.data : [], weekStart));
    }
    const tasks = await readMyTasks(db, userId);
    if (tasks.state === "ok") rows.push(...taskRows(tasks.data, userId, weekStart));
  } catch {
    /* Prefill is a courtesy; the form still works typed by hand. */
  }
  return rows;
}

export type WeekTableRow = { person: RosterPerson; report: WeeklyReport | null };

/** The reviewer's table for one week: every current staff member and their report, or none. */
export async function readWeekTable(db: SupabaseClient, weekStart: string): Promise<Read<WeekTableRow[]>> {
  const [roster, reports] = await Promise.all([readRoster(), readWeekReports(db, weekStart)]);
  if (reports.state !== "ok") return reports;
  if (roster.state !== "ok") return roster;
  const byAuthor = new Map(reports.data.filter((r) => r.authorId).map((r) => [r.authorId as string, r]));
  return { state: "ok", data: roster.data.map((person) => ({ person, report: byAuthor.get(person.userId) ?? null })) };
}
