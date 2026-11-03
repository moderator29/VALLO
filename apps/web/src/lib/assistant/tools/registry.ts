import { areaIntelTool } from "./area-intel";
import { compareListingsTool } from "./compare-listings";
import { findScreenTool } from "./find-screen";
import { searchListingsTool } from "./search-listings";
import { getListingDetailsTool, getListingPhotosTool } from "./listing-detail";
import {
  getMoveOptionsTool,
  getViewingOptionsTool,
  listMyBookingsTool,
  listMyViewingsTool,
  proposeCancelViewingTool,
  proposeRescheduleViewingTool,
  proposeViewingTool,
} from "./viewings";
import { listSavedListingsTool, pickedForYouTool, proposeSaveListingTool, rememberPreferenceTool } from "./saved";
import { getRefundStatusTool, getWalletBalanceTool, listMyTransactionsTool, proposePaymentTool, spendSummaryTool } from "./money";
import { getAccountSummaryTool } from "./account";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { assertPermission, auditAction } from "../access";
import { NO_ACCESS, hasPermission, type AssistantAccess } from "../permissions";
import type { AssistantTool, ToolContext, ToolDefinition, ToolFrame, ToolOutcome } from "./types";

/**
 * THE ASSISTANT'S TOOLS, IN ONE LIST (AI-01).
 *
 * The order is the order the Claude API is shown them, which is the order the
 * route always sent the first three in.
 */
export const TOOL_REGISTRY: readonly AssistantTool[] = [
  searchListingsTool,
  compareListingsTool,
  areaIntelTool,
  findScreenTool,
  /* Public: the real pictures and details of one place. */
  getListingPhotosTool,
  getListingDetailsTool,
  /* Private: each needs a permission the member granted, checked in the database. */
  pickedForYouTool,
  rememberPreferenceTool,
  listSavedListingsTool,
  proposeSaveListingTool,
  getViewingOptionsTool,
  proposeViewingTool,
  listMyViewingsTool,
  proposeCancelViewingTool,
  getMoveOptionsTool,
  proposeRescheduleViewingTool,
  listMyBookingsTool,
  listMyTransactionsTool,
  spendSummaryTool,
  getRefundStatusTool,
  getWalletBalanceTool,
  proposePaymentTool,
  getAccountSummaryTool,
];

/** Private tools are paced separately from chat: forty calls in ten minutes per member. */
const PRIVATE_TOOL_LIMIT = 40;
const PRIVATE_TOOL_WINDOW_SECONDS = 600;

/** The tools offered in `frame`. A tool outside its frames is not offered. */
export function toolsFor(
  frame: ToolFrame,
  registry: readonly AssistantTool[] = TOOL_REGISTRY,
  access: AssistantAccess = NO_ACCESS,
): AssistantTool[] {
  return registry.filter(
    (tool) => tool.workspaces.includes(frame) && (!tool.requires || hasPermission(access, tool.requires)),
  );
}

/** The `tools` field of a Claude API request, for `frame`. */
export function toolDefinitions(
  frame: ToolFrame,
  registry: readonly AssistantTool[] = TOOL_REGISTRY,
  access: AssistantAccess = NO_ACCESS,
): ToolDefinition[] {
  return toolsFor(frame, registry, access).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

export type ToolRun = { ok: true; outcome: ToolOutcome } | { ok: false; error: string };

/**
 * Run the tool the model named. Never throws: an unknown name, a tool not
 * offered in this frame, input the schema refuses, or a tool that fails all
 * come back as an error for the model to read, and the conversation carries
 * on.
 *
 * Anything unrecognised is refused honestly rather than falling through to a
 * search, because a model inventing a tool name and receiving plausible data
 * is worse than one told it asked for something that does not exist.
 */
export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
  registry: readonly AssistantTool[] = TOOL_REGISTRY,
): Promise<ToolRun> {
  const tool = registry.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `There is no tool called ${name}.` };
  if (!tool.workspaces.includes(ctx.frame)) {
    return { ok: false, error: `The tool ${name} is not available here.` };
  }
  /*
   * NOT OFFERED, NOT RUN (security review, 1 November 2026). A private tool
   * this request did not offer (the member has not granted it) is refused here,
   * before the database is asked, and logged as "refused", not "denied". A
   * listing or a message that talks the model into naming tools it was never
   * given must not be able to run up eight "denied" rows and so switch the
   * member's assistant off from the outside.
   */
  if (tool.requires && !hasPermission(ctx.access ?? NO_ACCESS, tool.requires)) {
    if (ctx.supabase) await auditAction(ctx.supabase, { event: "tool_not_offered", permission: tool.requires, tool: tool.name, outcome: "refused" });
    return { ok: false, error: `The tool ${name} was not offered in this conversation. Do not call it; answer with what you have.` };
  }
  /* An offered private tool is checked again against the DATABASE (a revoke
     since this request began), not against what the model or the browser
     says, and a refusal there is audited as denied. */
  if (tool.requires) {
    const verdict = await assertPermission(ctx.supabase, tool.requires, tool.name);
    if (!verdict.ok) {
      return { ok: false, error: `The tool ${name} needs a permission this person has not given. Say so, and point them to Settings, VALLO AI Assistant.` };
    }
  }
  if (tool.requires) {
    if (!ctx.userId) return { ok: false, error: `The tool ${name} needs a signed-in person.` };
    const pace = await consume({
      bucket: "assistant_private_tool",
      subject: subjectForUser(ctx.userId),
      limit: PRIVATE_TOOL_LIMIT,
      windowSeconds: PRIVATE_TOOL_WINDOW_SECONDS,
    });
    if (!pace.allowed) {
      await auditAction(ctx.supabase, { event: "tool_paced", permission: tool.requires, tool: tool.name, outcome: "refused" });
      return { ok: false, error: `Private lookups are paused for a moment. Ask the person to try again ${pace.retryIn}.` };
    }
  }
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "input"}: ${issue.message}`)
      .join("; ");
    return {
      ok: false,
      error: `${name} was called with input that does not match its schema (${problems}). Fix the input and call it again.`,
    };
  }
  try {
    const outcome = await tool.run(ctx, parsed.data);
    /* Every private call leaves one audit row: who, which permission, which tool, how it went. No payload. */
    if (tool.requires) {
      await auditAction(ctx.supabase, {
        event: "tool_run",
        permission: tool.requires,
        tool: tool.name,
        outcome: (outcome.data as { error?: unknown } | null)?.error ? "failed" : "ok",
      });
    }
    return { ok: true, outcome };
  } catch {
    if (tool.requires) await auditAction(ctx.supabase, { event: "tool_run", permission: tool.requires, tool: tool.name, outcome: "failed" });
    return { ok: false, error: `${name} could not finish just now. Answer without it and say so.` };
  }
}
