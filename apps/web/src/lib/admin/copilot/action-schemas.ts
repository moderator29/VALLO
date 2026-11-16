import { z } from "zod";
import {
  ANNOUNCE_BODY_MAX,
  ANNOUNCE_TITLE_MAX,
  COMMENT_MAX,
  DETAIL_MAX,
  TITLE_MAX,
  TASK_PRIORITIES,
  isAudience,
  isDeskScope,
  isInternalAdminLink,
  isIsoDate,
} from "@/lib/admin/my-desk/model";
import { BD_ACTIVITY_KINDS, BD_CATEGORIES } from "@/lib/admin/business-development/types";
import { CATEGORIES, FORMATS, PLATFORMS, SLOTS } from "@/lib/admin/social-media/model";

/**
 * THE INPUT OF EVERY CHANGE THE COPILOT CAN PROPOSE, in one place. A propose
 * tool parses its arguments with these when it builds the proposal, and the
 * act route parses them AGAIN from the signed token before running anything,
 * so a changed argument can never reach a desk action unchecked. The desk
 * actions then apply their own checks on top.
 *
 * The list is closed on purpose: it holds no money, no decision on a listing,
 * an identity or an appeal, no access grant and no deletion. Since 16
 * November 2026 (the founder: "it should always show a confirm button for you
 * to click, to reply to users or resolve stuff") it holds the desk work a
 * person does by hand all day: a reply on a support ticket, a ticket's status,
 * a step on an escalation, a risk alert, a message flag. Each is shown in full
 * on a card first and runs only when the person presses its button.
 */

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).default("");
const isoDate = z.string().refine((v) => isIsoDate(v), "Use a real date as YYYY-MM-DD.");

export const SOURCE_DESKS = ["listing_approval", "moderation", "support", "agreements", "operations", "business_development", "social_media", "other"] as const;

export const createMyTaskInput = z.object({
  title: text(TITLE_MAX),
  detail: optText(DETAIL_MAX),
  dueDate: z.union([z.literal(""), isoDate]).default(""),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  relatedDesk: z.union([z.literal(""), z.string().refine(isDeskScope, "Choose a desk from the list.")]).default(""),
  relatedLink: z.union([z.literal(""), z.string().refine(isInternalAdminLink, "A link must be a console path.")]).default(""),
});

export const addTaskCommentInput = z.object({ taskId: uuid, body: text(COMMENT_MAX) });

export const raiseEscalationInput = z.object({ sourceDesk: z.enum(SOURCE_DESKS), subject: text(200), detail: text(4000) });

export const addBdProspectInput = z
  .object({
    contactName: text(160),
    businessName: text(160),
    category: z.enum(BD_CATEGORIES),
    email: optText(200),
    phone: optText(40),
    location: optText(200),
    notes: optText(4000),
    nextFollowUpAt: z.union([z.literal(""), isoDate]).default(""),
  })
  .refine((v) => v.email !== "" || v.phone !== "", { message: "Add an email or a phone number.", path: ["email"] });

export const logBdActivityInput = z
  .object({ prospectId: uuid, kind: z.enum(BD_ACTIVITY_KINDS.filter((k) => k !== "stage_change") as ["contact", "follow_up", "note"]), body: text(2000), outcome: optText(500) })
  .refine((v) => v.kind !== "contact" || v.outcome !== "", { message: "Record the outcome of the contact.", path: ["outcome"] });

export const createSocialDraftInput = z.object({
  platform: z.enum(PLATFORMS),
  category: z.enum(CATEGORIES),
  format: z.enum(FORMATS).default("feed_post"),
  slot: z.union([z.literal(""), z.enum(SLOTS)]).default(""),
  campaign: optText(140),
  caption: z.string().trim().max(5000).default(""),
  plannedAt: isoDate,
});

export const recommendStaffAccessInput = z.object({ aboutName: text(200), recommendedPositionOrScope: text(200), reason: text(2000) });

export const postAnnouncementInput = z.object({
  title: text(ANNOUNCE_TITLE_MAX),
  body: text(ANNOUNCE_BODY_MAX),
  audience: z.string().refine(isAudience, "Choose who this is for."),
  pinned: z.boolean().default(false),
});

/* ------------------------------------------------- desk work (16 November) */

export const TICKET_THEN = ["keep", "resolve"] as const;
export const sendTicketReplyInput = z.object({
  ticketId: uuid,
  body: z.string().trim().min(2).max(4000),
  then: z.enum(TICKET_THEN).default("keep"),
});

export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export const setTicketStatusInput = z
  .object({ ticketId: uuid, status: z.enum(TICKET_STATUSES), note: optText(1000) })
  .refine((v) => v.status !== "closed" || v.note.length >= 8, { message: "Say what was done, in at least eight characters, to close a ticket.", path: ["note"] });

/** The escalation steps a person may take through the copilot. Assigning and rerouting stay on the desk. */
export const COPILOT_ESCALATION_STEPS = ["acknowledge", "comment", "ask_raiser", "resolve", "decline", "reopen"] as const;
export const escalationStepInput = z.object({ escalationId: uuid, step: z.enum(COPILOT_ESCALATION_STEPS), note: optText(4000) });

export const ALERT_STEPS = ["acknowledge", "resolve"] as const;
export const riskAlertStepInput = z.object({ alertId: uuid, step: z.enum(ALERT_STEPS), notes: optText(2000) });

export const FLAG_RESOLUTIONS = ["cleared", "escalated"] as const;
export const messageFlagInput = z.object({ flagId: uuid, resolution: z.enum(FLAG_RESOLUTIONS) });

/** The closed set of action kinds the act route can run, with the schema that guards each. */
export const ACTION_SCHEMAS = {
  create_my_task: createMyTaskInput,
  add_task_comment: addTaskCommentInput,
  raise_escalation: raiseEscalationInput,
  add_bd_prospect: addBdProspectInput,
  log_bd_activity: logBdActivityInput,
  create_social_draft: createSocialDraftInput,
  recommend_staff_access: recommendStaffAccessInput,
  post_announcement: postAnnouncementInput,
  send_ticket_reply: sendTicketReplyInput,
  set_ticket_status: setTicketStatusInput,
  escalation_step: escalationStepInput,
  risk_alert_step: riskAlertStepInput,
  review_message_flag: messageFlagInput,
} as const;

export type ActionKind = keyof typeof ACTION_SCHEMAS;
export const ACTION_KINDS = Object.keys(ACTION_SCHEMAS) as ActionKind[];
