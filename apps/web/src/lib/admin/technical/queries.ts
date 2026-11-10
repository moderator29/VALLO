import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { callProviderConfigured } from "@/lib/calls/provider";
import { isEmailConfigured } from "@/lib/email/client";
import { faults, isNotLive } from "@/lib/features/degrade";
import { isReportingConfigured } from "@/lib/observability/report";
import { reportReadFault } from "@/lib/observability/read-error";
import { isPaystackConfigured } from "@/lib/payments/paystack";
import { configuredTransports } from "@/lib/push/credentials";
import { isServiceConfigured } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { VERCEL_JOBS } from "@/lib/admin/reads/jobs";

import {
  dailyCounts,
  deploymentInfo,
  isIncidentStatus,
  isSeverity,
  jobHealth,
  parseCronAction,
  type DayCount,
  type DeploymentInfo,
  type Incident,
  type IncidentUpdate,
  type JobHealth,
  type JobRun,
} from "./model";

export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "error" };

type IncRow = {
  id: string; title: string; severity: string; status: string; started_at: string; resolved_at: string | null; summary: string | null;
  resolution_summary: string | null; created_by: string | null; created_at: string; updated_at: string;
};
const INC_SELECT = "id, title, severity, status, started_at, resolved_at, summary, resolution_summary, created_by, created_at, updated_at";

export async function readIncidents(db: SupabaseClient): Promise<DeskRead<Incident[]>> {
  const { data, error } = await db.from("tech_incidents").select(INC_SELECT).order("started_at", { ascending: false }).limit(300);
  if (error) {
    if (isNotLive(error)) return { state: "not-open" };
    await reportReadFault("read.admin.technical.incidents", ...faults(error));
    return { state: "error" };
  }
  return {
    state: "ok",
    data: ((data ?? []) as unknown as IncRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      severity: isSeverity(r.severity) ? r.severity : "sev3",
      status: isIncidentStatus(r.status) ? r.status : "open",
      startedAt: r.started_at,
      resolvedAt: r.resolved_at,
      summary: r.summary ?? "",
      resolutionSummary: r.resolution_summary,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

export async function readIncidentUpdates(db: SupabaseClient): Promise<DeskRead<IncidentUpdate[]>> {
  const { data, error } = await db.from("tech_incident_updates").select("id, incident_id, body, status_after, author_id, created_at").order("created_at", { ascending: true }).limit(2000);
  if (error) {
    if (isNotLive(error)) return { state: "not-open" };
    await reportReadFault("read.admin.technical.updates", ...faults(error));
    return { state: "error" };
  }
  return {
    state: "ok",
    data: ((data ?? []) as unknown as { id: string; incident_id: string; body: string; status_after: string | null; author_id: string | null; created_at: string }[]).map((r) => ({
      id: r.id,
      incidentId: r.incident_id,
      body: r.body,
      statusAfter: isIncidentStatus(r.status_after) ? r.status_after : null,
      authorId: r.author_id,
      createdAt: r.created_at,
    })),
  };
}

/* ------------------------------------------------------------------ health */

export type ErrorGroup = { source: string; type: string; area: string | null; release: string | null; occurrences: number; status: string; lastSeenAt: string };

export type Health = {
  deployment: DeploymentInfo;
  /** Providers by name: whether a key is set. Never the key. */
  providers: { name: string; configured: boolean }[];
  jobs: JobHealth[] | null;
  openAlerts: number | null;
  crashes: {
    open: number | null;
    last24h: number | null;
    bySource: Record<string, number> | null;
    daily: DayCount[] | null;
    groups: ErrorGroup[] | null;
  };
};

function providerList(): Health["providers"] {
  let push = false;
  try {
    push = configuredTransports().length > 0;
  } catch {
    push = false;
  }
  return [
    { name: "Database connection", configured: isSupabaseConfigured() },
    { name: "Service access to the database", configured: isServiceConfigured() },
    { name: "Email", configured: isEmailConfigured() },
    { name: "Card and bank payments (Paystack)", configured: isPaystackConfigured() },
    { name: "Video and audio calls", configured: callProviderConfigured() },
    { name: "Push notifications", configured: push },
    { name: "Error reporting", configured: isReportingConfigured() },
  ];
}

/**
 * THE HEALTH PANEL, READ-ONLY. Reached only after the technical door passed.
 * Each part is read on its own and is `null` when it could not be read, so the
 * desk says "not available" and never draws a zero. Counts, names of jobs and
 * error types only: no error message, no stack, no member, no key.
 */
export async function readHealth(now: number = Date.now()): Promise<Health> {
  let admin: SupabaseClient;
  try {
    admin = createAdminClient() as unknown as SupabaseClient;
  } catch {
    return { deployment: deploymentInfo(process.env), providers: providerList(), jobs: null, openAlerts: null, crashes: { open: null, last24h: null, bySource: null, daily: null, groups: null } };
  }
  const since14 = new Date(now - 14 * 86_400_000).toISOString();
  const since24 = new Date(now - 86_400_000).toISOString();
  const [runs, alerts, openCrashes, recent, stamps] = await Promise.all([
    admin.from("audit_log").select("action, created_at").eq("entity_type", "cron_job").gte("created_at", since14).order("created_at", { ascending: false }).limit(8000),
    admin.from("risk_alerts").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("crash_reports").select("source, error_type, area, release, occurrences, status, last_seen_at").eq("status", "open").order("last_seen_at", { ascending: false }).limit(300),
    admin.from("crash_reports").select("id", { count: "exact", head: true }).gte("last_seen_at", since24),
    admin.from("crash_reports").select("last_seen_at").gte("last_seen_at", since14).limit(5000),
  ]);
  for (const [kind, error] of [
    ["read.admin.technical.jobs", runs.error],
    ["read.admin.technical.alerts", alerts.error],
    ["read.admin.technical.crashes", openCrashes.error ?? recent.error ?? stamps.error],
  ] as const) {
    if (error && !isNotLive(error)) await reportReadFault(kind, ...faults(error));
  }
  const jobRuns: JobRun[] | null = runs.error
    ? null
    : ((runs.data ?? []) as { action: string; created_at: string }[]).flatMap((r) => {
        const parsed = parseCronAction(r.action);
        return parsed ? [{ ...parsed, at: r.created_at }] : [];
      });
  const groups = openCrashes.error
    ? null
    : ((openCrashes.data ?? []) as { source: string; error_type: string | null; area: string | null; release: string | null; occurrences: number | null; status: string; last_seen_at: string }[])
        .map((r) => ({ source: r.source, type: r.error_type ?? "Error", area: r.area, release: r.release, occurrences: Number(r.occurrences ?? 1), status: r.status, lastSeenAt: r.last_seen_at }))
        .sort((a, b) => b.occurrences - a.occurrences);
  const bySource: Record<string, number> | null = groups ? {} : null;
  if (groups && bySource) for (const g of groups) bySource[g.source] = (bySource[g.source] ?? 0) + 1;
  return {
    deployment: deploymentInfo(process.env),
    providers: providerList(),
    jobs: jobRuns
      ? jobHealth(VERCEL_JOBS.filter((j) => j.audit.entityType === "cron_job").map((j) => ({ name: j.name, schedule: j.schedule, maxGapHours: j.maxGapHours })), jobRuns, now)
      : null,
    openAlerts: alerts.error ? null : (alerts.count ?? 0),
    crashes: {
      open: groups ? groups.length : null,
      last24h: recent.error ? null : (recent.count ?? 0),
      bySource,
      daily: stamps.error ? null : dailyCounts(((stamps.data ?? []) as { last_seen_at: string }[]).map((r) => r.last_seen_at), 14),
      groups,
    },
  };
}
