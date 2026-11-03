import "server-only";

/**
 * PROPOSALS: THE ONLY ROAD FROM THE ASSISTANT TO AN ACTION.
 *
 * A tool never changes anything. When something should happen (a viewing, a
 * payment) the tool writes a PROPOSAL through `ai_proposal_create`, the screen
 * shows it, and only the member's own tap on Confirm turns it into an action.
 * The database holds the rules: a proposal belongs to one member, is bound to a
 * hash of its contents, expires in ten minutes, can be decided once, and fails
 * closed when the permission it needs has been revoked or the assistant has been
 * switched off since (`ai_proposal_decide`). Every call goes through the
 * member's own client; each function reads `auth.uid()` itself.
 */

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const rpc = (supabase: unknown) => supabase as Rpc;

export type ProposalKind =
  | "viewing_request"
  | "save_listing"
  | "unsave_listing"
  | "payment_review"
  | "reschedule_viewing"
  | "cancel_viewing";

export type ProposalRefusal =
  | "signed_out"
  | "unknown_kind"
  | "bad_payload"
  | "not_granted"
  | "not_found"
  | "already_decided"
  | "expired"
  | "hash_mismatch"
  | "revoked"
  | "bad_decision"
  | "not_retryable"
  | "unavailable";

export type ProposalMade = { ok: true; id: string; payloadHash: string; expiresAt: string } | { ok: false; reason: ProposalRefusal };

const REFUSALS: readonly ProposalRefusal[] = [
  "signed_out",
  "unknown_kind",
  "bad_payload",
  "not_granted",
  "not_found",
  "already_decided",
  "expired",
  "hash_mismatch",
  "revoked",
  "bad_decision",
  "not_retryable",
];

function refusalOf(value: unknown): ProposalRefusal {
  return typeof value === "string" && (REFUSALS as readonly string[]).includes(value) ? (value as ProposalRefusal) : "unavailable";
}

async function call(supabase: unknown, fn: string, args: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await rpc(supabase).rpc(fn, args);
    if (error || !data || typeof data !== "object") return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function createProposal(supabase: unknown, kind: ProposalKind, payload: Record<string, unknown>): Promise<ProposalMade> {
  const d = await call(supabase, "ai_proposal_create", { p_kind: kind, p_payload: payload });
  if (!d) return { ok: false, reason: "unavailable" };
  if (d.ok !== true) return { ok: false, reason: refusalOf(d.reason) };
  if (typeof d.id !== "string" || typeof d.payload_hash !== "string") return { ok: false, reason: "unavailable" };
  return { ok: true, id: d.id, payloadHash: d.payload_hash, expiresAt: typeof d.expires_at === "string" ? d.expires_at : "" };
}

export type ProposalDecided =
  | { ok: true; decision: "confirm"; kind: ProposalKind; payload: Record<string, unknown> }
  | { ok: true; decision: "cancel"; kind: ProposalKind }
  | { ok: false; reason: ProposalRefusal };

export async function decideProposal(
  supabase: unknown,
  id: string,
  decision: "confirm" | "cancel",
  payloadHash: string,
): Promise<ProposalDecided> {
  const d = await call(supabase, "ai_proposal_decide", { p_id: id, p_decision: decision, p_payload_hash: payloadHash });
  if (!d) return { ok: false, reason: "unavailable" };
  if (d.ok !== true) return { ok: false, reason: refusalOf(d.reason) };
  const kind = d.kind as ProposalKind;
  if (decision === "cancel") return { ok: true, decision: "cancel", kind };
  const payload = d.payload && typeof d.payload === "object" ? (d.payload as Record<string, unknown>) : {};
  return { ok: true, decision: "confirm", kind, payload };
}

/** Record what really happened, once, so a retry knows whether the first try failed. */
export async function recordProposalResult(supabase: unknown, id: string, result: Record<string, unknown>): Promise<void> {
  await call(supabase, "ai_proposal_result", { p_id: id, p_result: result });
}

/** A failed attempt can be offered again only as a NEW proposal. */
export async function retryProposal(supabase: unknown, id: string): Promise<ProposalMade> {
  const d = await call(supabase, "ai_proposal_retry", { p_id: id });
  if (!d) return { ok: false, reason: "unavailable" };
  if (d.ok !== true) return { ok: false, reason: refusalOf(d.reason) };
  if (typeof d.id !== "string" || typeof d.payload_hash !== "string") return { ok: false, reason: "unavailable" };
  return { ok: true, id: d.id, payloadHash: d.payload_hash, expiresAt: typeof d.expires_at === "string" ? d.expires_at : "" };
}

export type StoredProposal = { id: string; kind: ProposalKind; status: string; payload: Record<string, unknown>; result: Record<string, unknown> | null };

/** The member's own proposal, under row level security. Null when it is not theirs or not there. */
export async function readOwnProposal(supabase: unknown, id: string): Promise<StoredProposal | null> {
  try {
    const client = supabase as {
      from: (t: string) => {
        select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } };
      };
    };
    const { data, error } = await client.from("ai_action_proposals").select("id, kind, status, payload, result").eq("id", id).maybeSingle();
    if (error || !data || typeof data !== "object") return null;
    const r = data as Record<string, unknown>;
    return {
      id: String(r.id),
      kind: r.kind as ProposalKind,
      status: String(r.status),
      payload: (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<string, unknown>,
      result: r.result && typeof r.result === "object" ? (r.result as Record<string, unknown>) : null,
    };
  } catch {
    return null;
  }
}

/** One plain sentence for every refusal, for the screen. */
export function refusalWords(reason: ProposalRefusal): string {
  switch (reason) {
    case "expired":
      return "That offer timed out after ten minutes, so nothing was done. Ask again and I will set it up fresh.";
    case "revoked":
      return "You switched off what this needed, so nothing was done. You can turn it back on in Settings, VALLO AI Assistant.";
    case "not_granted":
      return "That needs a permission you have not given. You can turn it on in Settings, VALLO AI Assistant.";
    case "already_decided":
      return "That was already answered, so I did not do it twice.";
    case "hash_mismatch":
      return "Those details changed, so nothing was done. Ask again and review them once more.";
    case "not_found":
      return "I could not find that offer for your account. Nothing was done.";
    default:
      return "I could not do that just now. Nothing was changed. Try again in a moment.";
  }
}
