import { z } from "zod";
import { STAFF_SCOPES } from "@/lib/admin/guard";
import { canPostAnnouncements } from "@/lib/admin/my-desk/model";
import {
  addBdProspectInput,
  addTaskCommentInput,
  createMyTaskInput,
  createSocialDraftInput,
  logBdActivityInput,
  postAnnouncementInput,
  raiseEscalationInput,
  recommendStaffAccessInput,
} from "../action-schemas";
import { UUID_RE, clip, recheck, refused } from "./common";
import { cooAllowed } from "./coo";
import { defineTool, type ProposalDraft, type ToolResult } from "./types";

/**
 * THE PROPOSE TOOLS. None of them changes anything: each validates its
 * arguments and hands back a proposal for the person to confirm, edit in the
 * desk, or dismiss. Confirming runs the desk's own server action through
 * `/api/admin/copilot/act`, so that action's permission checks apply.
 *
 * There is deliberately NO tool for money movement, refunds, payouts,
 * restricting or banning a member, approving or rejecting anything, granting
 * or revoking access, deleting a record or sending a message to a member
 * (`copilot-limits.test.ts` holds that line).
 */

const done = (summary: string, draft: ProposalDraft): ToolResult => ({
  ok: true,
  data: { proposed: true, summary, note: "A proposal card is now on the person's screen. Nothing has been changed. Tell them to review it and press Confirm, or to make the change on the desk themselves." },
  proposal: draft,
});

export const createMyTask = defineTool({
  name: "create_my_task",
  description: "Propose adding a task to the viewer's OWN My Desk list (never for a colleague). Give a clear title, an optional detail, due date (YYYY-MM-DD), priority (low, normal, high, urgent) and an optional /admin link.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  status: "Preparing a task",
  input: createMyTaskInput,
  handler: async (input) => {
    const a = input;
    return done(`Add the task "${a.title}"`, {
      label: "Add a task to my list",
      summary: `Adds "${a.title}" to your My Desk tasks${a.dueDate ? `, due ${a.dueDate}` : ""}, priority ${a.priority}.`,
      args: { title: a.title, detail: clip(a.detail, 200), dueDate: a.dueDate || null, priority: a.priority },
      mode: "act",
      deskHref: "/admin/my-desk/tasks",
      action: { kind: "create_my_task", input: a },
    });
  },
});

export const addTaskComment = defineTool({
  name: "add_task_comment",
  description: "Propose a comment on one of the viewer's own tasks (by task id from get_my_tasks).",
  kind: "propose",
  scopes: STAFF_SCOPES,
  status: "Preparing a comment",
  input: addTaskCommentInput,
  handler: async (input) =>
    done("Comment on a task", {
      label: "Comment on a task",
      summary: `Adds this comment to the task: "${clip(input.body, 160)}".`,
      args: { taskId: input.taskId, comment: clip(input.body, 300) },
      mode: "act",
      deskHref: "/admin/my-desk/tasks",
      action: { kind: "add_task_comment", input },
    }),
});

export const raiseEscalation = defineTool({
  name: "raise_escalation",
  description: "Propose raising an escalation to the COO: which desk it comes from, a subject and what needs deciding. Admins and super admins only. It asks a person to decide; it decides nothing.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: (v) => v.isAdmin || v.isSuperAdmin,
  status: "Preparing an escalation",
  input: raiseEscalationInput,
  handler: async (input, ctx) => {
    if (!ctx.viewer.isAdmin && !ctx.viewer.isSuperAdmin) return refused();
    return done("Raise an escalation", {
      label: "Raise an escalation to the COO",
      summary: `Sends "${input.subject}" from the ${input.sourceDesk.replace(/_/g, " ")} desk to the COO desk for a decision.`,
      args: { fromDesk: input.sourceDesk, subject: input.subject, detail: clip(input.detail, 300) },
      mode: "act",
      deskHref: "/admin/overview",
      action: { kind: "raise_escalation", input },
    });
  },
});

export const addBdProspect = defineTool({
  name: "add_bd_prospect",
  description: "Propose adding a prospect to the partnership pipeline: contact name, business name, category (landlord, agent, hotel, shortlet_host, restaurant, other), and an email or a phone number.",
  kind: "propose",
  scopes: ["business_development"],
  status: "Preparing a prospect",
  input: addBdProspectInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["business_development"]);
    if (!gate.ok) return refused();
    return done("Add a prospect", {
      label: "Add a prospect to the pipeline",
      summary: `Adds ${input.businessName} (${input.contactName}, ${input.category.replace(/_/g, " ")}) as a new prospect.`,
      args: { business: input.businessName, contact: input.contactName, category: input.category, email: input.email || null, phone: input.phone || null, location: input.location || null, followUp: input.nextFollowUpAt || null },
      mode: "act",
      deskHref: "/admin/business-development",
      action: { kind: "add_bd_prospect", input },
    });
  },
});

export const logBdActivity = defineTool({
  name: "log_bd_activity",
  description: "Propose logging a contact (with its outcome), a follow-up or a note against a prospect, by prospect id from get_bd_pipeline.",
  kind: "propose",
  scopes: ["business_development"],
  status: "Preparing an activity",
  input: logBdActivityInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["business_development"]);
    if (!gate.ok) return refused();
    return done("Log an activity", {
      label: `Log a ${input.kind.replace("_", " ")}`,
      summary: `Records a ${input.kind.replace("_", " ")} on the prospect: "${clip(input.body, 160)}".`,
      args: { prospectId: input.prospectId, kind: input.kind, text: clip(input.body, 300), outcome: input.outcome || null },
      mode: "act",
      deskHref: "/admin/business-development",
      action: { kind: "log_bd_activity", input },
    });
  },
});

export const createSocialDraft = defineTool({
  name: "create_social_draft",
  description: "Propose a new social media post as a DRAFT on the content calendar: platform, category, format, optional slot (post_1 to post_4), campaign, caption and the planned date (YYYY-MM-DD). It is only a draft; nothing is posted and nothing is sent for approval.",
  kind: "propose",
  scopes: ["social_media"],
  status: "Preparing a draft post",
  input: createSocialDraftInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["social_media"]);
    if (!gate.ok) return refused();
    return done("Save a draft post", {
      label: "Save a draft post",
      summary: `Saves a ${input.platform} ${input.format.replace(/_/g, " ")} for ${input.plannedAt} as a draft. Nothing is posted.`,
      args: { platform: input.platform, category: input.category, format: input.format, plannedFor: input.plannedAt, slot: input.slot || null, campaign: input.campaign || null, caption: clip(input.caption, 300) },
      mode: "act",
      deskHref: "/admin/social-media",
      action: { kind: "create_social_draft", input },
    });
  },
});

export const recommendStaffAccess = defineTool({
  name: "recommend_staff_access",
  description: "Propose a staff access RECOMMENDATION for the super admin to consider (who, which position or access area, and why). COO only. It leaves a note; it grants and revokes nothing.",
  kind: "propose",
  scopes: ["operations"],
  allow: cooAllowed,
  status: "Preparing a recommendation",
  input: recommendStaffAccessInput,
  handler: async (input, ctx) => {
    if (!cooAllowed(ctx.viewer)) return refused();
    return done("Recommend an access change", {
      label: "Recommend a staff access change",
      summary: `Leaves a note for the super admin recommending ${input.recommendedPositionOrScope} for ${input.aboutName}. It does not change anyone's access.`,
      args: { about: input.aboutName, recommends: input.recommendedPositionOrScope, reason: clip(input.reason, 300) },
      mode: "act",
      deskHref: "/admin/overview",
      action: { kind: "recommend_staff_access", input },
    });
  },
});

export const postAnnouncement = defineTool({
  name: "post_announcement",
  description: "Propose a staff announcement (title, message, audience 'all' or one access area, pinned or not). Only the COO, an admin or a super admin may post one. It reaches staff only, never members.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: (v) => canPostAnnouncements(v),
  status: "Preparing an announcement",
  input: postAnnouncementInput,
  handler: async (input, ctx) => {
    if (!canPostAnnouncements(ctx.viewer)) return refused();
    return done("Post an announcement", {
      label: "Post a staff announcement",
      summary: `Posts "${input.title}" to ${input.audience === "all" ? "all staff" : `staff with ${input.audience.replace(/_/g, " ")} access`}${input.pinned ? ", pinned" : ""}.`,
      args: { title: input.title, message: clip(input.body, 300), audience: input.audience, pinned: input.pinned },
      mode: "act",
      deskHref: "/admin/my-desk/announcements",
      action: { kind: "post_announcement", input },
    });
  },
});

/* ------------------------------------------------------------------ drafts */

const draftText = z.string().trim().min(1).max(3000);

export const draftTicketReply = defineTool({
  name: "draft_ticket_reply",
  description:
    "Draft a reply to a support ticket (by ticket id) for the agent to read, edit and send themselves from the support desk. This does NOT send anything. Write it warm and plain, never promise an outcome another desk decides, and use the house money wording.",
  kind: "propose",
  scopes: ["support"],
  status: "Drafting a reply",
  input: z.object({ ticketId: z.string().regex(UUID_RE), text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support"]);
    if (!gate.ok) return refused();
    return done("Draft a ticket reply", {
      label: "Draft reply (not sent)",
      summary: "A draft for you to read, edit and send from the ticket. Nothing has been sent to the member.",
      args: { text: input.text },
      mode: "draft",
      deskHref: `/admin/support?ticket=${input.ticketId}`,
      action: null,
    });
  },
});

export const draftCaseNote = defineTool({
  name: "draft_case_note",
  description: "Draft an internal note for a Trust and Safety case (by case id) for the reviewer to paste into the case. It does NOT save anything and never goes to the member.",
  kind: "propose",
  scopes: ["trust_safety", "moderation", "roommates", "circle"],
  status: "Drafting a case note",
  input: z.object({ caseId: z.string().regex(UUID_RE), text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["trust_safety", "moderation", "roommates", "circle"]);
    if (!gate.ok) return refused();
    return done("Draft a case note", {
      label: "Draft case note (not saved)",
      summary: "A draft internal note for you to read, edit and add on the case. Nothing has been saved.",
      args: { text: input.text },
      mode: "draft",
      deskHref: `/admin/cases/${input.caseId}`,
      action: null,
    });
  },
});

export const PROPOSE_TOOLS = [
  createMyTask,
  addTaskComment,
  raiseEscalation,
  addBdProspect,
  logBdActivity,
  createSocialDraft,
  recommendStaffAccess,
  postAnnouncement,
  draftTicketReply,
  draftCaseNote,
];
