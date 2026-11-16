import type { z } from "zod";
import type { StaffScope } from "@/lib/admin/guard";
import type { StaffPosition } from "@/lib/admin/staff-positions";
import type { CopilotForm } from "../forms";

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
  /**
   * The words exactly as somebody else will read them (a reply to a member, a
   * closing note the raiser reads), drawn as a preview above the button.
   */
  preview?: { heading: string; text: string };
  /** The button's own words ("Send reply", "Resolve alert"); "Confirm" when absent. */
  confirmLabel?: string;
  /**
   * For a change that is hard to take back: the word the person types before
   * the button wakes. Sealed in the token and checked again on the server.
   */
  confirmWord?: string;
  /** The signed token Confirm sends back. Absent for a draft. */
  token?: string;
  expiresAt: string;
};

/** What a propose handler returns; the registry adds the tool name, id, token and expiry. */
export type ProposalDraft = Omit<CopilotProposal, "id" | "tool" | "token" | "expiresAt"> & { action: ProposalAction | null };

/**
 * A PLACE THE ANSWER MAY OFFER AS A BUTTON. A tool returns the desks its
 * answer is about; the registry drops every one the viewer may not open
 * before the model sees it (`lib/admin/copilot/tools/links.ts`), and the renderer draws only
 * these as buttons. `scope` names the access area that opens it: leave it out
 * for a page every member of staff can open.
 */
export type ToolLink = {
  label: string;
  href: string;
  /** The access area that opens it. Leave it out for a page every member of staff can open. */
  scope?: StaffScope;
  /** A role the page needs on top of the scopes: the COO bundle, an admin, or the super admin alone. */
  requires?: "coo" | "admin" | "super_admin";
};

export type ToolResult =
  | { ok: true; data: unknown; note?: string; proposal?: ProposalDraft; links?: readonly ToolLink[]; form?: CopilotForm }
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
  | { kind: "post_announcement"; input: { title: string; body: string; audience: string; pinned: boolean } }
  | { kind: "send_ticket_reply"; input: { ticketId: string; body: string; then: "keep" | "resolve" } }
  | { kind: "set_ticket_status"; input: { ticketId: string; status: "open" | "pending" | "resolved" | "closed"; note: string } }
  | { kind: "escalation_step"; input: { escalationId: string; step: "acknowledge" | "comment" | "ask_raiser" | "resolve" | "decline" | "reopen"; note: string } }
  | { kind: "risk_alert_step"; input: { alertId: string; step: "acknowledge" | "resolve"; notes: string } }
  | { kind: "review_message_flag"; input: { flagId: string; resolution: "cleared" | "escalated" } }
  | { kind: "review_listing"; input: { listingId: string; decision: "approve" | "reject" | "request_changes"; notes: string } }
  | { kind: "review_agent_application"; input: { applicationId: string; decision: "approve" | "reject" | "request_changes"; notes: string } }
  | { kind: "decide_identity_check"; input: { checkId: string; approve: boolean; reason: string } }
  | { kind: "set_switch"; input: { key: string; enabled: boolean } }
  | { kind: "restrict_member"; input: { userId: string; kind: "warning" | "messaging" | "posting" | "roommates" | "suspended"; days: number | null; reason: string } }
  | { kind: "lift_restriction"; input: { restrictionId: string; reason: string } }
  | { kind: "grant_staff"; input: { email: string; position: string; scopes: string[]; note: string } }
  | { kind: "revoke_staff"; input: { userId: string; reason: string } }
  | { kind: "refund_booking"; input: { bookingId: string; amountMinor: number; reason: "guest_choice" | "host_cancelled" | "not_as_listed" | "no_access" | "goodwill" | "duplicate_charge"; note: string } }
  | { kind: "decide_held_item"; input: { target: "post" | "story" | "comment" | "bio"; id: string; decision: "RELEASE" | "REMOVE"; reason: string } };

export type CopilotTool = {
  name: string;
  description: string;
  kind: "read" | "propose";
  /** Any one of these scopes opens the tool. Admins and super admins hold all of them. */
  scopes: readonly StaffScope[];
  /** A further rule on top of the scopes (for example the COO position). */
  allow?: (viewer: CopilotViewer) => boolean;
  /**
   * The super admin's own hands (16 November 2026): offered to the super
   * admin and nobody else, whatever their scopes. Only a tool marked so may
   * carry a name the registry otherwise refuses (decide, restrict, refund).
   */
  superAdminOnly?: true;
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
  superAdminOnly?: true;
  status: string;
  input: S;
  handler: (input: z.infer<S>, ctx: ToolCtx) => Promise<ToolResult>;
}): CopilotTool {
  return { ...def, handler: def.handler as (input: unknown, ctx: ToolCtx) => Promise<ToolResult> };
}
