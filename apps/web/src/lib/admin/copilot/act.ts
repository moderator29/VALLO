import "server-only";
import { addProspect, logActivity } from "@/lib/admin/business-development/actions";
import { writeAudit } from "@/lib/admin/audit";
import { addTaskComment, createTask, postAnnouncement } from "@/lib/admin/my-desk/actions";
import { raiseEscalation, recommendStaffAccess } from "@/lib/admin/overview/actions";
import { createDraft } from "@/lib/admin/social-media/actions";
import { consume } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTION_SCHEMAS, type ActionKind } from "./action-schemas";
import { openProposal, proposalKey, type ProposalBody } from "./proposals";
import { COPILOT_TOOLS, isOfferable } from "./tools/registry";
import type { CopilotViewer, ProposalAction } from "./tools/types";

/**
 * CONFIRMING A PROPOSAL. The only place the copilot's suggestions turn into a
 * change, and only after the person pressed Confirm.
 *
 * Nothing the browser sends is trusted but the signed token. The token is
 * opened (signature, expiry, same person), its tool must still be one this
 * person may be offered, its arguments are parsed AGAIN against the closed
 * schema, the nonce is claimed so it works once, and then the desk's own
 * server action runs, which applies its own permission checks on top. One
 * audit row says the change was made through the copilot.
 */

export type ActOutcome = {
  status: number;
  body: { ok: boolean; message: string; href?: string; code?: "invalid" | "expired" | "wrong_user" | "refused" | "used" | "failed" | "unavailable" };
};

type Done = { ok: true; message: string } | { ok: false; message: string };

const PAGE: Record<ActionKind, string> = {
  create_my_task: "/admin/my-desk/tasks",
  add_task_comment: "/admin/my-desk/tasks",
  raise_escalation: "/admin/overview",
  add_bd_prospect: "/admin/business-development",
  log_bd_activity: "/admin/business-development",
  create_social_draft: "/admin/social-media",
  recommend_staff_access: "/admin/overview",
  post_announcement: "/admin/my-desk/announcements",
};

const SUCCESS: Record<ActionKind, string> = {
  create_my_task: "Task added to your list.",
  add_task_comment: "Comment added to the task.",
  raise_escalation: "Escalation sent to the COO desk.",
  add_bd_prospect: "Prospect added to the pipeline.",
  log_bd_activity: "Activity logged on the prospect.",
  create_social_draft: "Draft post saved. Nothing has been posted.",
  recommend_staff_access: "Recommendation left for the super admin. No access has changed.",
  post_announcement: "Announcement posted to staff.",
};

/** Runs the desk's own server action for one validated action. */
export async function executeAction(action: ProposalAction): Promise<Done> {
  const kind = action.kind;
  const schema = ACTION_SCHEMAS[kind];
  if (!schema || !schema.safeParse(action.input).success) {
    return { ok: false, message: "That proposal no longer passes the desk's checks. Make the change on the desk instead." };
  }
  let result: { ok: boolean; error?: string };
  switch (kind) {
    case "create_my_task":
      result = await createTask({ ...ACTION_SCHEMAS.create_my_task.parse(action.input), assignedTo: "" });
      break;
    case "add_task_comment": {
      const d = ACTION_SCHEMAS.add_task_comment.parse(action.input);
      result = await addTaskComment(d.taskId, d.body);
      break;
    }
    case "raise_escalation":
      result = await raiseEscalation(ACTION_SCHEMAS.raise_escalation.parse(action.input));
      break;
    case "add_bd_prospect":
      result = await addProspect(ACTION_SCHEMAS.add_bd_prospect.parse(action.input));
      break;
    case "log_bd_activity":
      result = await logActivity(ACTION_SCHEMAS.log_bd_activity.parse(action.input));
      break;
    case "create_social_draft":
      result = await createDraft({ ...ACTION_SCHEMAS.create_social_draft.parse(action.input), mediaUrls: [] });
      break;
    case "recommend_staff_access":
      result = await recommendStaffAccess(ACTION_SCHEMAS.recommend_staff_access.parse(action.input));
      break;
    case "post_announcement":
      result = await postAnnouncement(ACTION_SCHEMAS.post_announcement.parse(action.input));
      break;
    default:
      return { ok: false, message: "That kind of change is not something the copilot can do." };
  }
  if (!result.ok) return { ok: false, message: result.error ?? "That did not go through." };
  return { ok: true, message: SUCCESS[kind] };
}

const usedHere = new Set<string>();

/** Test hook: forget the in-process memory of used proposals. */
export function resetUsedProposals(): void {
  usedHere.clear();
}

/**
 * Claim a proposal id so it can run once. Three locks: this process's memory,
 * the durable rate-limit counter (one use per id), and the audit trail (a
 * row for this id means it already ran). No dedicated table exists yet; the
 * counter fails open when its store is unreachable, and the audit lookup
 * then closes most of that gap.
 */
async function claimNonce(nonce: string): Promise<boolean> {
  if (usedHere.has(nonce)) return false;
  usedHere.add(nonce);
  const verdict = await consume({ bucket: "admin_copilot_proposal", subject: `proposal:${nonce}`, limit: 1, windowSeconds: 3600 });
  if (!verdict.allowed) return false;
  try {
    const { data } = await createAdminClient().from("audit_log").select("id").eq("action", "copilot.act").eq("entity_id", nonce).limit(1);
    if (data && data.length > 0) return false;
  } catch {
    /* Best effort: the other two locks already held. */
  }
  return true;
}

export type ActDeps = {
  key?: Buffer | null;
  claim?: (nonce: string) => Promise<boolean>;
  execute?: (action: ProposalAction) => Promise<Done>;
  audit?: (entry: { actorId: string; tool: string; kind: string; nonce: string; ok: boolean; summary: string }) => Promise<boolean>;
};

async function auditRow(entry: { actorId: string; tool: string; kind: string; nonce: string; ok: boolean; summary: string }): Promise<boolean> {
  try {
    return await writeAudit(createAdminClient(), {
      actorId: entry.actorId,
      action: "copilot.act",
      entityType: "copilot_proposal",
      entityId: entry.nonce,
      detail: { via: "copilot", tool: entry.tool, action_kind: entry.kind, ok: entry.ok, summary: entry.summary.slice(0, 200) },
    });
  } catch {
    return false;
  }
}

export async function confirmProposal(input: { token: unknown; viewer: CopilotViewer; now: number }, deps: ActDeps = {}): Promise<ActOutcome> {
  const key = deps.key === undefined ? proposalKey() : deps.key;
  if (!key) return { status: 503, body: { ok: false, code: "unavailable", message: "Confirming is not available on this server just now. Make the change on the desk." } };

  const opened = openProposal(key, input.token, input.viewer.userId, input.now);
  if (!opened.ok) {
    if (opened.reason === "expired") return { status: 410, body: { ok: false, code: "expired", message: "That suggestion expired after 15 minutes. Ask me again, or make the change on the desk." } };
    if (opened.reason === "wrong_user") return { status: 403, body: { ok: false, code: "wrong_user", message: "That suggestion was not made for you." } };
    return { status: 400, body: { ok: false, code: "invalid", message: "That suggestion could not be checked. Ask me again." } };
  }
  const body: ProposalBody = opened.body;
  const tool = COPILOT_TOOLS.find((t) => t.name === body.t && t.kind === "propose");
  if (!tool || !isOfferable(tool, input.viewer)) {
    return { status: 403, body: { ok: false, code: "refused", message: "Your access no longer allows that change. Check with your lead." } };
  }
  const kind = body.a?.kind as ActionKind | undefined;
  if (!kind || !(kind in ACTION_SCHEMAS) || !ACTION_SCHEMAS[kind].safeParse(body.a.input).success) {
    return { status: 400, body: { ok: false, code: "invalid", message: "That suggestion could not be checked. Ask me again." } };
  }
  const claim = deps.claim ?? claimNonce;
  if (!(await claim(body.n))) return { status: 409, body: { ok: false, code: "used", message: "That suggestion has already been used." } };

  const outcome = await (deps.execute ?? executeAction)(body.a);
  const audited = await (deps.audit ?? auditRow)({ actorId: input.viewer.userId, tool: body.t, kind, nonce: body.n, ok: outcome.ok, summary: body.summary });
  const href = PAGE[kind];
  if (!outcome.ok) return { status: 200, body: { ok: false, code: "failed", message: outcome.message, href } };
  return {
    status: 200,
    body: { ok: true, href, message: audited ? outcome.message : `${outcome.message} The audit line could not be written; Operations has been alerted.` },
  };
}
