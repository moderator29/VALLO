import type { z } from "zod";
import type { StaffScope } from "@/lib/admin/guard";
import type { StaffPosition } from "@/lib/admin/staff-positions";

/**
 * ONE SHAPE FOR EVERY ADMIN COPILOT TOOL (copilot v2, 10 November 2026).
 *
 * A tool is a registry entry: a name, a plain description for the model, the
 * staff scopes that may use it, whether it only reads or may PROPOSE a change
 * for a human to confirm, a zod input schema and a handler. The handler runs
 * on the server, re-checks the viewer's access with the same guard the desk
 * uses, and reuses the desk's own read function. Nothing here writes: a
 * propose tool returns a proposal, and only `/api/admin/copilot/act` runs the
 * desk's existing server action after the person confirms.
 */

/** Who is using the copilot, resolved once per request from the console door. */
export type CopilotViewer = {
  userId: string;
  firstName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Every scope the viewer holds. An admin or super admin holds all of them. */
  scopes: readonly StaffScope[];
  position: StaffPosition | null;
};

export type ToolCtx = {
  viewer: CopilotViewer;
  /** The server clock for this request, in epoch milliseconds. */
  now: number;
};

/** A change the copilot suggests. It runs only when its human confirms it. */
export type CopilotProposal = {
  /** A single-use id (the nonce inside the signed token). */
  id: string;
  tool: string;
  /** Short title for the card, for example "Add a task". */
  label: string;
  /** What will happen, in plain words. */
  summary: string;
  /** The fields that will be used, for the card to show. */
  args: Record<string, string | number | boolean | null>;
  /** "act": Confirm runs the desk action. "draft": text for the person to copy; nothing runs. */
  mode: "act" | "draft";
  /** The real desk page where the person can make the same change by hand. */
  deskHref: string;
  /** The signed token Confirm sends back. Absent for a draft. */
  token?: string;
  expiresAt: string;
};

/** What a propose handler returns; the registry adds the tool name, id, token and expiry. */
export type ProposalDraft = Omit<CopilotProposal, "id" | "tool" | "token" | "expiresAt"> & { action: ProposalAction | null };

export type ToolResult =
  | { ok: true; data: unknown; note?: string; proposal?: ProposalDraft }
  | { ok: false; error: string };

/** The writes the act route can run. Each maps to one existing server action. */
export type ProposalAction =
  | { kind: "create_my_task"; input: { title: string; detail: string; dueDate: string; priority: string; relatedDesk: string; relatedLink: string } }
  | { kind: "add_task_comment"; input: { taskId: string; body: string } }
  | { kind: "raise_escalation"; input: { sourceDesk: string; subject: string; detail: string } }
  | { kind: "add_bd_prospect"; input: { contactName: string; businessName: string; category: string; email: string; phone: string; location: string; notes: string; nextFollowUpAt: string } }
  | { kind: "log_bd_activity"; input: { prospectId: string; kind: "contact" | "follow_up" | "note"; body: string; outcome: string } }
  | { kind: "create_social_draft"; input: { platform: string; category: string; format: string; slot: string; campaign: string; caption: string; plannedAt: string } }
  | { kind: "recommend_staff_access"; input: { aboutName: string; recommendedPositionOrScope: string; reason: string } }
  | { kind: "post_announcement"; input: { title: string; body: string; audience: string; pinned: boolean } };

export type CopilotTool = {
  name: string;
  description: string;
  kind: "read" | "propose";
  /** Any one of these scopes opens the tool. Admins and super admins hold all of them. */
  scopes: readonly StaffScope[];
  /** A further rule on top of the scopes (for example the COO position). */
  allow?: (viewer: CopilotViewer) => boolean;
  /** The status line the person sees while the tool runs. */
  status: string;
  input: z.ZodType;
  handler: (input: unknown, ctx: ToolCtx) => Promise<ToolResult>;
};

export function defineTool<S extends z.ZodType>(def: {
  name: string;
  description: string;
  kind: "read" | "propose";
  scopes: readonly StaffScope[];
  allow?: (viewer: CopilotViewer) => boolean;
  status: string;
  input: S;
  handler: (input: z.infer<S>, ctx: ToolCtx) => Promise<ToolResult>;
}): CopilotTool {
  return { ...def, handler: def.handler as (input: unknown, ctx: ToolCtx) => Promise<ToolResult> };
}
