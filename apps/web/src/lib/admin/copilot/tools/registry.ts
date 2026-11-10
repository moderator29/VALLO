import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fenceToolResult } from "@/lib/assistant/untrusted";
import { sealProposal, proposalKey, PROPOSAL_LIFETIME_MS } from "../proposals";
import { holdsAny, scrub } from "./common";
import { AGREEMENT_TOOLS } from "./agreements";
import { ANALYTICS_TOOLS } from "./analytics";
import { BD_TOOLS } from "./business-development";
import { COMPLIANCE_TOOLS } from "./compliance";
import { COO_TOOLS } from "./coo";
import { FINANCE_TOOLS } from "./finance";
import { KYC_TOOLS } from "./kyc";
import { LISTING_TOOLS } from "./listings";
import { MANUAL_TOOLS } from "./manual";
import { MY_TOOLS } from "./me";
import { MODERATION_TOOLS } from "./moderation";
import { OPERATIONS_TOOLS } from "./operations";
import { PROPOSE_TOOLS } from "./propose";
import { SOCIAL_TOOLS } from "./social-media";
import { STAFF_DESK_TOOLS } from "./staff-desks";
import { SUPPORT_TOOLS } from "./support";
import { TRUST_TOOLS } from "./trust";
import type { CopilotProposal, CopilotTool, CopilotViewer, ProposalDraft, ToolCtx } from "./types";

/**
 * THE COPILOT'S TOOLS, IN ONE LIST. Order is the order the model is shown them.
 */
export const COPILOT_TOOLS: readonly CopilotTool[] = [
  ...MY_TOOLS,
  ...MANUAL_TOOLS,
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
  ...COO_TOOLS,
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
  if (FORBIDDEN_TOOL_NAME.test(tool.name)) return false;
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
};

const MAX_RESULT_CHARS = 14_000;

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
    if (tool.kind === "propose" && result.proposal) {
      const proposal = finalizeProposal(tool.name, result.proposal, ctx);
      if (!proposal) return { ok: false, content: fence({ error: "Proposals are not available on this server just now. Tell the person to make the change on the desk." }) };
      return { ok: true, proposal, content: fence(result.data, result.note) };
    }
    return { ok: true, content: fence(result.data, result.note) };
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
  const { token, body } = sealProposal(key, { u: ctx.viewer.userId, t: tool, a: action, label: card.label, summary: card.summary }, ctx.now);
  return { ...card, id: body.n, tool, token, expiresAt };
}
