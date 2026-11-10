import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { faults, isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";

import { isPolicyStatus, type PolicyNote, type QaReview } from "./model";

export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "error" };

export async function readQaReviews(db: SupabaseClient): Promise<DeskRead<QaReview[]>> {
  const { data, error } = await db
    .from("support_qa_reviews")
    .select("id, ticket_ref, reviewed_agent, reviewer_id, tone, accuracy, speed, policy, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    await reportReadFault("read.admin.support-lead.qa", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return {
    state: "ok",
    data: ((data ?? []) as unknown as { id: string; ticket_ref: string; reviewed_agent: string | null; reviewer_id: string | null; tone: number; accuracy: number; speed: number; policy: number; notes: string | null; created_at: string }[]).map((r) => ({
      id: r.id,
      ticketRef: r.ticket_ref,
      reviewedAgent: r.reviewed_agent,
      reviewerId: r.reviewer_id,
      tone: r.tone,
      accuracy: r.accuracy,
      speed: r.speed,
      policy: r.policy,
      notes: r.notes ?? "",
      createdAt: r.created_at,
    })),
  };
}

export async function readPolicyNotes(db: SupabaseClient): Promise<DeskRead<PolicyNote[]>> {
  const { data, error } = await db
    .from("support_policy_notes")
    .select("id, title, body, status, approved_by, approved_at, created_by, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) {
    await reportReadFault("read.admin.support-lead.policy", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return {
    state: "ok",
    data: ((data ?? []) as unknown as { id: string; title: string; body: string | null; status: string; approved_by: string | null; approved_at: string | null; created_by: string | null; created_at: string; updated_at: string }[]).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body ?? "",
      status: isPolicyStatus(r.status) ? r.status : "draft",
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

/** Topics of the tickets filed in the last `days` days (the topic word only, no message, no name). */
export async function readTicketTopics(db: SupabaseClient, days = 30, now: number = Date.now()): Promise<{ state: "ok"; topics: (string | null)[]; since: string } | { state: "error" }> {
  const since = new Date(now - days * 86_400_000).toISOString();
  const { data, error } = await db.from("support_tickets").select("topic").gte("created_at", since).limit(5000);
  if (error) {
    if (!isNotLive(error)) await reportReadFault("read.admin.support-lead.topics", ...faults(error));
    return { state: "error" };
  }
  return { state: "ok", topics: ((data ?? []) as { topic: string | null }[]).map((r) => r.topic), since };
}

/** How the tickets filed in the last `days` days stand now: counts by status. Outcomes, not content. */
export async function readTicketOutcomes(db: SupabaseClient, days = 30, now: number = Date.now()): Promise<Record<string, number> | null> {
  const since = new Date(now - days * 86_400_000).toISOString();
  const { data, error } = await db.from("support_tickets").select("status").gte("created_at", since).limit(5000);
  if (error) {
    if (!isNotLive(error)) await reportReadFault("read.admin.support-lead.outcomes", ...faults(error));
    return null;
  }
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { status: string }[]) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}
