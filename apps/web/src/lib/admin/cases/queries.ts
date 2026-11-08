import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireConsole } from "@/lib/admin/guard";
import { isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";
import type { RoomCard, PersonRef, BadgeKind } from "@/lib/features/roommates/model";
import { roommatePhotoUrl } from "@/lib/features/roommates/model";
import { SUPABASE_URL } from "@/lib/supabase/env";

import type { CaseDetail, CaseFilters, CaseRow, RestrictionKind } from "./model";

/**
 * TRUST AND SAFETY, THE READS. Every one runs on the staff member's OWN
 * session (not the service client a scoped desk gets), because the database
 * decides what this person may see from `auth.uid()`: `private.case_can` for
 * cases, the module scope for the Roommates and Circle desks, `documents` for
 * verification evidence. A refusal reads as `forbidden`, a missing function
 * (the SQL not pasted yet) as `not-open`. Nothing here is ever a sample.
 */

type Db = SupabaseClient;
export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "forbidden" } | { state: "signed-out" };

async function own(): Promise<{ db: Db } | { state: "signed-out" | "forbidden" | "not-open" }> {
  const access = await requireConsole();
  if (access.state === "unconfigured") return { state: "not-open" };
  if (access.state === "signed-out") return { state: "signed-out" };
  if (access.state !== "console") return { state: "forbidden" };
  return { db: access.supabase as unknown as Db };
}

async function call<T>(fn: string, args: Record<string, unknown>, kind: `read.${string}`): Promise<DeskRead<T>> {
  const who = await own();
  if (!("db" in who)) return { state: who.state };
  const { data, error } = await who.db.rpc(fn, args);
  if (error) {
    if (isNotLive(error)) return { state: "not-open" };
    if (error.code === "42501") return { state: "forbidden" };
    await reportReadFault(kind, error);
    return { state: "forbidden" };
  }
  return { state: "ok", data: data as T };
}

export async function readCases(f: CaseFilters): Promise<DeskRead<{ items: CaseRow[]; total: number; next: number | null }>> {
  return call(
    "admin_cases_list",
    {
      p: {
        status: f.status,
        module: f.module,
        severity: f.severity,
        assigned: f.assigned,
        overdue: f.overdue,
        q: f.q || null,
        offset: f.offset,
        limit: 50,
      },
    },
    "read.admin.cases",
  );
}

export async function readCase(id: string): Promise<DeskRead<CaseDetail | null>> {
  return call("admin_case_view", { p_id: id }, "read.admin.case");
}

export type TrustOverview = {
  since: string;
  cases: {
    open: number;
    new: number;
    escalated: number;
    overdue: number;
    unassigned: number;
    critical: number;
    openedInPeriod: number;
    resolvedInPeriod: number;
    medianHoursToResolve: number | null;
    byModule: Record<string, number>;
    byCategory: Record<string, number>;
    daily: { day: string; opened: number; resolved: number }[];
  };
  restrictions: { active: number; suspended: number; appealsOpen: number };
  roommates: {
    profiles: { active: number; draft: number; paused: number; held: number; newInPeriod: number };
    interests: { sent: number; accepted: number; declined: number };
    listings: { live: number; newInPeriod: number; unverifiedLive: number; removed: number };
    groups: { active: number; newInPeriod: number };
    viewings: number;
    verificationsWaiting: number;
  };
  circle: {
    communities: { live: number; paused: number; removed: number };
    posts: { inPeriod: number; held: number; removedInPeriod: number };
  };
};

export async function readTrustOverview(days: number): Promise<DeskRead<TrustOverview>> {
  return call("admin_trust_overview", { p_days: days }, "read.admin.trust");
}

export type AppealRow = {
  id: string;
  status: "open" | "upheld" | "overturned" | "withdrawn";
  body: string;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  member: PersonRef;
  restriction: { id: string; kind: RestrictionKind; reason: string; endsAt: string | null; createdBy: PersonRef | null } | null;
  caseNumber: number | null;
};

export async function readAppeals(status: string | null): Promise<DeskRead<AppealRow[] | null>> {
  return call("admin_appeals_list", { p_status: status }, "read.admin.appeals");
}

/* ------------------------------------------------------------------ Roommates desk */

export type AdminRoommateProfile = PersonRef & {
  status: string;
  lifeStage: string | null;
  city: string | null;
  createdAt: string;
  lastActiveAt: string;
  badges: BadgeKind[];
  openCases: number;
  listings: number;
};

export async function readAdminRoommateProfiles(p: { status?: string | null; q?: string; flagged?: boolean; offset?: number }): Promise<DeskRead<AdminRoommateProfile[]>> {
  return call("admin_roommate_profiles", { p: { status: p.status ?? null, q: p.q || null, flagged: Boolean(p.flagged), offset: p.offset ?? 0, limit: 50 } }, "read.admin.rm-profiles");
}

export type AdminRoommateListing = RoomCard & { authority: string | null; viewCount: number; interestCount: number; createdAt: string; openCases: number };

export async function readAdminRoommateListings(p: { status?: string | null; unverified?: boolean; q?: string; offset?: number }): Promise<DeskRead<AdminRoommateListing[]>> {
  const res = await call<AdminRoommateListing[]>(
    "admin_roommate_listings",
    { p: { status: p.status ?? null, unverified: Boolean(p.unverified), q: p.q || null, offset: p.offset ?? 0, limit: 50 } },
    "read.admin.rm-listings",
  );
  if (res.state !== "ok") return res;
  return { state: "ok", data: (res.data ?? []).map((l) => ({ ...l, photoUrls: (l.photoUrls ?? []).map((x) => roommatePhotoUrl(SUPABASE_URL, x)) })) };
}

export type AdminRoommateGroup = {
  id: string;
  name: string;
  stage: string;
  visibility: string;
  city: string | null;
  createdAt: string;
  owner: PersonRef | null;
  members: number;
  posts7d: number;
  openCases: number;
};

export async function readAdminRoommateGroups(p: { stage?: string | null; offset?: number }): Promise<DeskRead<AdminRoommateGroup[]>> {
  return call("admin_roommate_groups", { p: { stage: p.stage ?? null, offset: p.offset ?? 0, limit: 50 } }, "read.admin.rm-groups");
}

export type AdminVerification = {
  id: string;
  kind: string;
  status: string;
  member: PersonRef;
  institution: { id: string; name: string; shortName: string | null } | null;
  emailMasked: string | null;
  hasDocument: boolean;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: PersonRef | null;
};

export async function readAdminVerifications(status: string | null): Promise<DeskRead<AdminVerification[]>> {
  return call("admin_roommate_verifications", { p_status: status }, "read.admin.rm-verifications");
}

export type RoommateSignals = {
  heavySenders: (PersonRef & { sent: number; declined: number })[];
  repeatListers: (PersonRef & { live: number })[];
  duplicateTitles: { title: string; count: number; owners: number }[];
  reportedOften: (PersonRef & { cases: number })[];
};

export async function readRoommateSignals(): Promise<DeskRead<RoommateSignals>> {
  return call("admin_roommates_signals", {}, "read.admin.rm-signals");
}

/* ------------------------------------------------------------------ Circle desk */

export type AdminCommunity = {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: "live" | "paused" | "removed";
  visibility: string;
  byVallo: boolean;
  members: number;
  posts: number;
  lastActivityAt: string | null;
  createdAt: string;
  owner: PersonRef | null;
  held: number;
  openCases: number;
};

export async function readAdminCommunities(p: { status?: string | null; q?: string }): Promise<DeskRead<AdminCommunity[]>> {
  return call("admin_circle_communities", { p: { status: p.status ?? null, q: p.q || null } }, "read.admin.circle");
}
