import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fenceToolResult } from "@/lib/assistant/untrusted";
import { DESTINATION_SYNTAX, type Destination } from "../destinations";
import { sealProposal, proposalKey, PROPOSAL_LIFETIME_MS } from "../proposals";
import { holdsAny, scrub } from "./common";
import { offerableLinks } from "./links";
import { AGREEMENT_TOOLS } from "./agreements";
import { ANALYTICS_TOOLS } from "./analytics";
import { BD_TOOLS } from "./business-development";
import { COMPLIANCE_TOOLS } from "./compliance";
import { CONTROL_ROOM_TOOLS } from "./control-room";
import { COO_TOOLS } from "./coo";
import { HANDBOOK_TOOLS } from "./handbook";
import { DELETION_REASON_TOOLS } from "./deletion-reasons";
import { DESK_ACTION_TOOLS } from "./desk-actions";
import { SUPER_ADMIN_TOOLS } from "./super-admin";
import { ESCALATION_TOOLS } from "./escalations";
import { FINANCE_TOOLS } from "./finance";
import { KYC_TOOLS } from "./kyc";
import { LISTING_TOOLS } from "./listings";
import { MANUAL_TOOLS } from "./manual";
import { MY_TOOLS } from "./me";
import { MODERATION_TOOLS } from "./moderation";
import { OPERATIONS_TOOLS } from "./operations";
import { PLATFORM_TOOLS } from "./platform";
import { PROPOSE_TOOLS } from "./propose";
import { SOCIAL_TOOLS } from "./social-media";
import { STAFF_DESK_TOOLS } from "./staff-desks";
import { SUPPORT_TOOLS } from "./support";
import { TRUST_TOOLS } from "./trust";
import { WAYFINDING_TOOLS } from "./wayfinding";
import type { CopilotProposal, CopilotTool, CopilotViewer, ProposalDraft, ToolCtx } from "./types";
import { copilotFormSchema } from "../forms.schema";
import type { CopilotForm } from "../forms";
import { ASK_TOOLS } from "./ask";

/**
 * THE COPILOT'S TOOLS, IN ONE LIST. Order is the order the model is shown them.
 */
export const COPILOT_TOOLS: readonly CopilotTool[] = [
  ...MY_TOOLS,
  /* Question cards (16 November 2026): every desk asks for details with a card to tap. */
  ...ASK_TOOLS,
  /* Escalations (15 November 2026): open to every staff member, on every desk. */
  ...ESCALATION_TOOLS,
  /* Where do I go (16 November 2026): the console's own map, every desk. */
  ...WAYFINDING_TOOLS,
  ...MANUAL_TOOLS,
  /* The position handbook (16 November 2026): the viewer's own, every desk. */
  ...HANDBOOK_TOOLS,
  ...LISTING_TOOLS,
  ...KYC_TOOLS,
  ...MODERATION_TOOLS,
  ...TRUST_TOOLS,
  ...SUPPORT_TOOLS,
  ...AGREEMENT_TOOLS,
  ...FINANCE_TOOLS,
  ...COMPLIANCE_TOOLS,
  ...OPERATIONS_TOOLS,
  ...ANALYTICS_TOOLS,
  ...BD_TOOLS,
  ...SOCIAL_TOOLS,
  ...STAFF_DESK_TOOLS,
  ...DELETION_REASON_TOOLS,
  ...COO_TOOLS,
  /* Desk work behind a button (16 November 2026): replies, statuses, escalation steps, alerts, flags. */
  ...DESK_ACTION_TOOLS,
  /* The super admin's own hands (16 November 2026): theirs alone, each behind a preview and, where hard to undo, a typed word. */
  ...SUPER_ADMIN_TOOLS,
  /* The control room (15 November 2026): a super admin only. */
  ...CONTROL_ROOM_TOOLS,
  /* The platform, the staff and the audit trail (16 November 2026): a super admin only. */
  ...PLATFORM_TOOLS,
  ...PROPOSE_TOOLS,
];

/**
 * A tool whose name says it moves money, decides, restricts, grants, deletes
 * or messages a member is never offered, even if somebody registers one by
 * mistake. The registry test also fails on it, so it is caught twice.
 */
export const FORBIDDEN_TOOL_NAME =
  /(refund|payout|pay_|_pay\b|transfer|withdraw|restrict|suspend|\bban|ban_|approve|reject|decide|grant|revoke|delete|destroy|remove|erase|send_message|message_member|notify_member|resolve|close_case)/i;

export function isOfferable(tool: CopilotTool, viewer: CopilotViewer): boolean {
  /* The super admin's own tools (`lib/admin/copilot/tools/super-admin.ts`) are theirs alone. A
     forbidden name is offered only on such a tool, and only to them. */
  if (tool.superAdminOnly && !viewer.isSuperAdmin) return false;
  if (FORBIDDEN_TOOL_NAME.test(tool.name) && !(tool.superAdminOnly && viewer.isSuperAdmin)) return false;
  if (!holdsAny(viewer, tool.scopes)) return false;
  if (tool.allow && !tool.allow(viewer)) return false;
  return true;
}

/** ONLY the tools whose scopes (and extra rule) the viewer holds. */
export function toolsForViewer(viewer: CopilotViewer, registry: readonly CopilotTool[] = COPILOT_TOOLS): CopilotTool[] {
  return registry.filter((tool) => isOfferable(tool, viewer));
}

export type ToolDefinition = { name: string; description: string; input_schema: Record<string, unknown> };

export function toolDefinitions(tools: readonly CopilotTool[]): ToolDefinition[] {
  return tools.map((tool) => {
    const schema = z.toJSONSchema(tool.input) as Record<string, unknown>;
    delete schema.$schema;
    return { name: tool.name, description: tool.description, input_schema: { type: "object", ...schema } };
  });
}

export type ToolRun = {
  /** The text handed back to the model, inside the untrusted-data fence. */
  content: string;
  ok: boolean;
  proposal?: CopilotProposal;
  /** The destinations this viewer may be offered, already filtered by access. */
  destinations?: Destination[];
  /** A question card for the person's screen (`ask_form`), checked against the schema again here. */
  form?: CopilotForm;
};

const MAX_RESULT_CHARS = 14_000;

/** What the model is told about a result that carries destinations. */
const DESTINATION_NOTE = `Each entry under takeMeThere is a page this person may open. End your answer by offering the ones that help, each written exactly as ${DESTINATION_SYNTAX} on its own line, using the address and the words given. Offer no other address as a destination.`;

/** Keeps the destination list beside a tool's own fields whatever shape it returned. */
function asObject(data: unknown): Record<string, unknown> {
  return data !== null && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : { result: data };
}

function fence(data: unknown, note?: string): string {
  const text = fenceToolResult(scrub(data), note);
  return text.length > MAX_RESULT_CHARS
    ? fenceToolResult({ truncated: true, message: "The result was too long to pass on. Ask for fewer items or a narrower question." }, note)
    : text;
}

/**
 * Runs the tool the model named. Never throws. A tool that was not offered to
 * THIS viewer is refused here whatever the model asks for, so a support-only
 * viewer cannot reach a finance tool by naming it.
 */
export async function runCopilotTool(name: string, input: unknown, ctx: ToolCtx, offered: readonly CopilotTool[]): Promise<ToolRun> {
  const tool = offered.find((t) => t.name === name);
  if (!tool) {
    return { ok: false, content: fence({ error: `The tool ${name} is not available to this person. Do not call it; say it is not on their desks.` }) };
  }
  if (!isOfferable(tool, ctx.viewer)) {
    return { ok: false, content: fence({ error: `The tool ${name} is not available to this person.` }) };
  }
  const parsed = tool.input.safeParse(input ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return { ok: false, content: fence({ error: `${name} was called with input that does not match its schema (${problems}). Fix it and call again.` }) };
  }
  try {
    const result = await tool.handler(parsed.data, ctx);
    if (!result.ok) return { ok: false, content: fence({ error: result.error }) };
    /* THE LINK FILTER. Every destination the tool offered is checked against
       this viewer's own access here, before the model is shown the result, so
       a desk they cannot open is dropped rather than left unsaid. */
    const destinations = offerableLinks(result.links, ctx.viewer);
    const payload = destinations.length > 0 ? { ...asObject(result.data), takeMeThere: destinations } : result.data;
    const note = destinations.length > 0 ? `${result.note ? `${result.note} ` : ""}${DESTINATION_NOTE}` : result.note;
    if (tool.kind === "propose" && result.proposal) {
      const proposal = finalizeProposal(tool.name, result.proposal, ctx);
      if (!proposal) return { ok: false, content: fence({ error: "Proposals are not available on this server just now. Tell the person to make the change on the desk." }) };
      return { ok: true, proposal, destinations, content: fence(payload, note) };
    }
    if (result.form) {
      const checked = copilotFormSchema.safeParse(result.form);
      if (!checked.success) return { ok: false, content: fence({ error: "That card does not pass the checks. Ask in a sentence instead." }) };
      return { ok: true, destinations, form: { ...checked.data, id: result.form.id }, content: fence(payload, note) };
    }
    return { ok: true, destinations, content: fence(payload, note) };
  } catch {
    return { ok: false, content: fence({ error: `${name} failed just now. Say it could not be read; do not guess a figure.` }) };
  }
}

/** Turns a handler's draft into a card: a draft is plain text, an action is signed. */
export function finalizeProposal(tool: string, draft: ProposalDraft, ctx: ToolCtx): CopilotProposal | null {
  const expiresAt = new Date(ctx.now + PROPOSAL_LIFETIME_MS).toISOString();
  const { action, ...card } = draft;
  if (draft.mode === "draft" || !action) return { ...card, id: randomUUID(), tool, mode: "draft", expiresAt };
  const key = proposalKey();
  if (!key) return null;
  const { token, body } = sealProposal(key, { u: ctx.viewer.userId, t: tool, a: action, label: card.label, summary: card.summary, ...(card.confirmWord ? { cw: card.confirmWord } : {}) }, ctx.now);
  return { ...card, id: body.n, tool, token, expiresAt };
}
