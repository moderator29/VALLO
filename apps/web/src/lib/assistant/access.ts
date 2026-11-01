import "server-only";

import {
  AI_PERMISSIONS,
  NO_ACCESS,
  hasPermission,
  type AiPermission,
  type AssistantAccess,
} from "./permissions";

export {
  AI_PERMISSIONS,
  AI_PRIVACY_VERSION,
  AI_TERMS_VERSION,
  PERMISSIONS,
  hasPermission,
  type AiPermission,
  type AssistantAccess,
} from "./permissions";

/**
 * THE ENFORCEMENT LAYER, SERVER SIDE.
 *
 * The model never decides what it may see. Every private read or action goes
 * through here, with the CALLER'S OWN authenticated client: each database
 * function reads `auth.uid()` itself, so there is no way to ask about another
 * person, and the service role is never used. A permission is checked against
 * the database on every request and again before every tool runs, and a
 * refusal is written to the audit log (eight refusals in ten minutes switch the
 * assistant off for that person, in the database).
 *
 * Loose client type: these functions are new and not in the generated types.
 */
type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const rpc = (supabase: unknown) => supabase as Rpc;

export type AssistantState = AssistantAccess & {
  signedIn: boolean;
  acceptedAt: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  needsReaccept: boolean;
};

const OFF: AssistantState = {
  ...NO_ACCESS,
  signedIn: false,
  acceptedAt: null,
  termsVersion: null,
  privacyVersion: null,
  needsReaccept: false,
};

/** Read the person's assistant state from the database. Any failure reads as OFF: the safe answer. */
export async function readAssistantState(supabase: unknown): Promise<AssistantState> {
  try {
    const { data, error } = await rpc(supabase).rpc("ai_assistant_state");
    if (error || !data || typeof data !== "object") return OFF;
    const d = data as Record<string, unknown>;
    if (d.signed_in !== true) return OFF;
    const permissions = Array.isArray(d.permissions)
      ? (d.permissions as unknown[]).filter((p): p is AiPermission => (AI_PERMISSIONS as readonly string[]).includes(p as string))
      : [];
    const enabled = d.enabled === true;
    return {
      signedIn: true,
      enabled,
      /* Off means no permission, whatever rows exist. */
      permissions: enabled ? permissions : [],
      epoch: typeof d.grant_epoch === "number" ? d.grant_epoch : 0,
      acceptedAt: typeof d.accepted_at === "string" ? d.accepted_at : null,
      termsVersion: typeof d.terms_version === "string" ? d.terms_version : null,
      privacyVersion: typeof d.privacy_version === "string" ? d.privacy_version : null,
      needsReaccept: d.needs_reaccept === true,
    };
  } catch {
    return OFF;
  }
}

export type PermissionVerdict = { ok: true } | { ok: false; reason: "assistant_off" | "not_granted" };

/**
 * Ask the database (not the model, not the browser) whether `permission` is
 * granted right now. A denial is audited. Fails closed.
 */
export async function assertPermission(
  supabase: unknown,
  permission: AiPermission,
  tool?: string,
): Promise<PermissionVerdict> {
  let allowed = false;
  try {
    const { data, error } = await rpc(supabase).rpc("ai_assistant_can", { p_permission: permission });
    allowed = !error && data === true;
  } catch {
    allowed = false;
  }
  if (allowed) return { ok: true };
  await auditAction(supabase, {
    event: "tool_denied",
    permission,
    ...(tool ? { tool } : {}),
    outcome: "denied",
  });
  return { ok: false, reason: "not_granted" };
}

/** In-memory check against an already-read state (for hiding tools). The database still decides at run time. */
export function stateAllows(state: AssistantAccess, permission: AiPermission): boolean {
  return hasPermission(state, permission);
}

export type AuditInput = {
  event: string;
  permission?: AiPermission;
  tool?: string;
  outcome?: "ok" | "denied" | "refused" | "failed";
  /** Never secrets: the database strips the obvious keys, and callers must not send any. */
  detail?: Record<string, unknown>;
};

/** Write one audit row for the caller. Never throws: an audit failure must not break a read, and must not hide one. */
export async function auditAction(supabase: unknown, input: AuditInput): Promise<void> {
  try {
    await rpc(supabase).rpc("ai_assistant_audit_write", {
      p_event: input.event,
      p_permission: input.permission ?? null,
      p_tool: input.tool ?? null,
      p_outcome: input.outcome ?? "ok",
      p_detail: input.detail ?? {},
    });
  } catch {
    /* Nothing to do: the answer to the person does not depend on the log. */
  }
}

export type AuditRow = { id: number; at: string; event: string; permission: string | null; tool: string | null; outcome: string };

/** The person's own last rows of activity, under row level security. */
export async function readAuditRows(supabase: unknown, limit = 30): Promise<AuditRow[]> {
  try {
    const client = supabase as {
      from: (t: string) => {
        select: (c: string) => {
          order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }> };
        };
      };
    };
    const { data, error } = await client
      .from("ai_assistant_audit")
      .select("id, at, event, permission, tool, outcome")
      .order("at", { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data as AuditRow[];
  } catch {
    return [];
  }
}

export type LearnedPreference = { key: string; value: unknown; source: string; weight: number; updated_at: string };

/** The person's learned tastes, under row level security. */
export async function readLearnedPreferences(supabase: unknown): Promise<LearnedPreference[]> {
  try {
    const client = supabase as {
      from: (t: string) => {
        select: (c: string) => { order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: unknown }> };
      };
    };
    const { data, error } = await client
      .from("ai_learned_preferences")
      .select("key, value, source, weight, updated_at")
      .order("updated_at", { ascending: false });
    if (error || !Array.isArray(data)) return [];
    /* A forgotten preference is scrubbed in place and keeps a `cleared:` key; it is never shown. */
    return (data as LearnedPreference[]).filter((row) => !String(row.key).startsWith("cleared:"));
  } catch {
    return [];
  }
}
