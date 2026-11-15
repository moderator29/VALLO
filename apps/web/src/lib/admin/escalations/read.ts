import "server-only";

import { requireConsole } from "@/lib/admin/guard";
import { isNotDeployed, reportReadFault } from "@/lib/observability/read-error";
import {
  ESCALATION_EVENT_KINDS,
  isEscalationCategory,
  isEscalationSeverity,
  isEscalationStatus,
  type EscalationEvent,
  type EscalationEventKind,
  type EscalationLevel,
  type EscalationRecord,
  type EscalationRow,
  type EscalationView,
  type EscalationViewer,
} from "./types";

/**
 * THE ESCALATION READS: the lists, one record, and the counts for the badge.
 *
 * THE DOOR is the console's own (`requireConsole`): an admin, or a staff
 * member with at least one scope, on a session that proved its security key.
 * Every read then goes through a database function on the CALLER'S OWN
 * session (`staff_escalation_list`, `_get`, `_counts`), which asks again who
 * they are and answers only what they may see. Nothing here uses the service
 * client, and the tables themselves are closed to everybody.
 *
 * GRACEFUL UNTIL THE SQL IS LIVE. The functions do not exist until the
 * founder runs `supabase/migrations/pending/staff_escalations_2026-11-15.sql`.
 * A missing function (PGRST202 or 42883) is read as `{ state: "not_set_up" }`,
 * so every screen draws a plain "not set up yet" panel instead of failing.
 */

export type EscalationRead<T> =
  | { state: "ok"; data: T }
  | { state: "not_set_up" }
  | { state: "forbidden" }
  | { state: "not_found" }
  | { state: "unavailable" };

export type EscalationListData = { view: EscalationView; rows: EscalationRow[]; canSeeAll: boolean };
export type EscalationCounts = { waiting: number; overdue: number; staffed: string[]; canSeeAll: boolean };
export type EscalationDetail = {
  record: EscalationRecord;
  events: EscalationEvent[];
  viewer: EscalationViewer;
  assignable: { id: string; name: string }[];
};

type RpcError = { code?: string | null; message?: string | null };
type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
const obj = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** One row as the database answers it, or null when it is not a row. */
export function toEscalationRow(raw: unknown): EscalationRow | null {
  const r = obj(raw);
  if (!r) return null;
  const id = str(r.id);
  const reference = str(r.reference);
  const dueAt = str(r.due_at);
  const createdAt = str(r.created_at);
  if (!id || !reference || !dueAt || !createdAt) return null;
  const level = Number(r.level);
  return {
    id,
    reference,
    title: str(r.title) ?? "Untitled",
    category: isEscalationCategory(r.category) ? r.category : "other",
    severity: isEscalationSeverity(r.severity) ? r.severity : "normal",
    status: isEscalationStatus(r.status) ? r.status : "open",
    routedTo: str(r.routed_to) ?? "coo",
    level: (level === 1 || level === 2 ? level : 0) as EscalationLevel,
    sourceDesk: str(r.source_desk) ?? "/admin",
    raisedByName: str(r.raised_by_name),
    raisedByMe: r.raised_by_me === true,
    assignedToName: str(r.assigned_to_name),
    assignedToMe: r.assigned_to_me === true,
    dueAt,
    createdAt,
    updatedAt: str(r.updated_at) ?? createdAt,
    acknowledgedAt: str(r.acknowledged_at),
    resolvedAt: str(r.resolved_at),
    waitingOnMe: r.waiting_on_me === true,
  };
}

function toEvent(raw: unknown): EscalationEvent | null {
  const r = obj(raw);
  if (!r) return null;
  const id = str(r.id);
  const createdAt = str(r.created_at);
  const kind = r.kind;
  if (!id || !createdAt || !(ESCALATION_EVENT_KINDS as readonly unknown[]).includes(kind)) return null;
  return {
    id,
    kind: kind as EscalationEventKind,
    body: str(r.body),
    detail: obj(r.detail) ?? {},
    createdAt,
    system: r.system === true,
    actorName: str(r.actor_name),
    actorMe: r.actor_me === true,
  };
}

/** The whole answer of `staff_escalation_get`, or null when it is not one. */
export function toEscalationDetail(raw: unknown): EscalationDetail | null {
  const answer = obj(raw);
  const base = toEscalationRow(answer?.escalation);
  const e = obj(answer?.escalation);
  if (!answer || !base || !e) return null;
  const viewer = obj(answer.viewer) ?? {};
  return {
    record: {
      ...base,
      whatHappened: str(e.what_happened) ?? "",
      whatIsNeeded: str(e.what_is_needed) ?? "",
      recordUrl: str(e.record_url),
      recordLabel: str(e.record_label),
      resolution: str(e.resolution),
      resolvedByName: str(e.resolved_by_name),
    },
    events: (Array.isArray(answer.events) ? answer.events : []).map(toEvent).filter((x): x is EscalationEvent => x !== null),
    viewer: {
      isRaiser: viewer.is_raiser === true,
      isHandler: viewer.is_handler === true,
      isLead: viewer.is_lead === true,
      isAssignee: viewer.is_assignee === true,
    },
    assignable: (Array.isArray(answer.assignable) ? answer.assignable : [])
      .map((p) => {
        const person = obj(p);
        const id = str(person?.id);
        return id ? { id, name: str(person?.name) ?? "A colleague" } : null;
      })
      .filter((x): x is { id: string; name: string } => x !== null),
  };
}

type Called = { state: "ok"; answer: Record<string, unknown> } | { state: "not_set_up" | "forbidden" | "not_found" | "unavailable" };

/** One call through the console door, with every refusal turned into a state. */
async function call(kind: `read.${string}`, fn: string, args: Record<string, unknown>): Promise<Called> {
  const door = await requireConsole();
  if (door.state !== "console") return { state: "forbidden" };
  let result: { data: unknown; error: RpcError | null };
  try {
    result = await (door.supabase as unknown as RpcClient).rpc(fn, args);
  } catch (thrown) {
    await reportReadFault(kind, thrown);
    return { state: "unavailable" };
  }
  const notSetUp = isNotDeployed(result.error);
  await reportReadFault(kind, result.error);
  if (notSetUp) return { state: "not_set_up" };
  if (result.error) return { state: "unavailable" };
  const answer = obj(result.data);
  if (!answer) return { state: "unavailable" };
  if (answer.status === "forbidden") return { state: "forbidden" };
  if (answer.status === "not_found") return { state: "not_found" };
  if (answer.status !== "ok") return { state: "unavailable" };
  return { state: "ok", answer };
}

/** "Waiting on me", "Raised by me" or, for the COO and the super admin, "All". */
export async function listEscalations(view: EscalationView): Promise<EscalationRead<EscalationListData>> {
  const called = await call("read.escalations.list", "staff_escalation_list", { p_view: view });
  if (called.state !== "ok") return called;
  const rows = (Array.isArray(called.answer.rows) ? called.answer.rows : [])
    .map(toEscalationRow)
    .filter((row): row is EscalationRow => row !== null);
  return { state: "ok", data: { view, rows, canSeeAll: called.answer.can_see_all === true } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One record with its timeline, only if the caller may see it. */
export async function getEscalation(id: string): Promise<EscalationRead<EscalationDetail>> {
  if (!UUID.test(id)) return { state: "not_found" };
  const called = await call("read.escalations.get", "staff_escalation_get", { p_id: id });
  if (called.state !== "ok") return called;
  const detail = toEscalationDetail(called.answer);
  return detail ? { state: "ok", data: detail } : { state: "unavailable" };
}

/** The nav badge: how many wait on the caller, how many of those are overdue. */
export async function getEscalationCounts(): Promise<EscalationRead<EscalationCounts>> {
  const called = await call("read.escalations.counts", "staff_escalation_counts", {});
  if (called.state !== "ok") return called;
  const a = called.answer;
  return {
    state: "ok",
    data: {
      waiting: Math.max(0, Number(a.waiting) || 0),
      overdue: Math.max(0, Number(a.overdue) || 0),
      staffed: Array.isArray(a.staffed) ? a.staffed.filter((s): s is string => typeof s === "string") : [],
      canSeeAll: a.can_see_all === true,
    },
  };
}
