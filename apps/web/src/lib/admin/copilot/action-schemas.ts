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
 * The list is closed on purpose: it holds no money, no member-facing message,
 * no decision, no access grant and no deletion.
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
} as const;

export type ActionKind = keyof typeof ACTION_SCHEMAS;
export const ACTION_KINDS = Object.keys(ACTION_SCHEMAS) as ActionKind[];
