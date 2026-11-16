import { z } from "zod";
import { STAFF_SCOPES, requireConsole } from "@/lib/admin/guard";
import { getFeatureFlags, getListingSubmissions } from "@/lib/admin/queries";
import {
  decideHeldItemInput,
  decideIdentityCheckInput,
  grantStaffInput,
  liftRestrictionInput,
  refundBookingInput,
  restrictMemberInput,
  reviewAgentApplicationInput,
  reviewListingInput,
  revokeStaffInput,
  setSwitchInput,
} from "../action-schemas";
import { UUID_RE, clip, refused, unreadable } from "./common";
import { defineTool, type CopilotViewer, type ProposalDraft, type ToolCtx, type ToolResult } from "./types";

/**
 * THE SUPER ADMIN'S HANDS (16 November 2026, the founder: "it can do anything
 * in the platform that a super admin can do from the admin panel").
 *
 * Every tool here is the super admin's alone: offered only to them, re-checked
 * on the console door when it runs, and re-checked again when the card is
 * pressed (`act.ts`, `isOfferable`). Each shows a preview; the ones that are
 * hard to take back (a decision a member is told about, a restriction, a
 * switch, staff access, money) also need a word typed on the card, sealed in
 * the token and checked on the server. Pressing the card runs the desk's own
 * server action, with that desk's own checks: nothing here skips a step the
 * desk itself requires, and every change is in the audit log as made through
 * the copilot.
 */

const superOnly = (viewer: CopilotViewer) => viewer.isSuperAdmin;

async function superGate(ctx: ToolCtx): Promise<boolean> {
  if (!ctx.viewer.isSuperAdmin) return false;
  const door = await requireConsole();
  return door.state === "console" && door.user.id === ctx.viewer.userId && door.staff.isSuperAdmin;
}

const proposed = (summary: string, draft: ProposalDraft): ToolResult => ({
  ok: true,
  data: {
    proposed: true,
    summary,
    note: "A card with the full preview is on their screen. Nothing has happened. Tell them in one line what pressing it does, and that it needs the word on the card typed first where it asks for one.",
  },
  proposal: draft,
});

const issue = (e: z.ZodError) => e.issues[0]?.message ?? "That does not pass the desk's checks.";

/* -------------------------------------------------------------- listings */

export const decideListing = defineTool({
  name: "decide_listing",
  description:
    "Super admin only. Approve (publishes it), reject, or send back for changes a listing waiting in review, by listing id from get_listing_queue. Rejecting or asking for changes needs notes the lister will read (ten characters or more). Read it with get_listing_review first.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing the listing decision",
  input: z.object({ listingId: z.string().regex(UUID_RE), decision: z.enum(["approve", "reject", "request_changes"]), notes: z.string().trim().max(1000).optional() }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const parsed = reviewListingInput.safeParse({ ...input, notes: input.notes ?? "" });
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    const queue = await getListingSubmissions({});
    if (queue.state !== "ok") return unreadable("The listing queue");
    const found = [...queue.data.waiting, ...queue.data.decided].find((l) => l.id === input.listingId);
    if (!found) return { ok: false, error: "That listing is not in the review queue. Point them to the listing desk." };
    const word = { approve: "Approve and publish", reject: "Reject", request_changes: "Send back for changes" }[input.decision];
    return proposed(`${word}: ${found.title || "listing"}`, {
      label: `${word}: ${clip(found.title || "Untitled listing", 70)}`,
      summary: input.decision === "approve" ? "Publishes the listing and tells the lister." : "The lister is told, with your notes.",
      args: { listing: clip(found.title || "Untitled listing", 100), reference: found.reference ?? null, listedBy: found.agentName ?? null, decision: word },
      ...(parsed.data.notes ? { preview: { heading: "What the lister will read", text: parsed.data.notes } } : {}),
      confirmLabel: word,
      ...(input.decision === "approve" ? {} : { confirmWord: "SEND" }),
      mode: "act",
      deskHref: `/admin/listings/${input.listingId}`,
      action: { kind: "review_listing", input: parsed.data },
    });
  },
});

/* ------------------------------------------------------- agent applications */

export const decideAgentApplication = defineTool({
  name: "decide_agent_application",
  description: "Super admin only. Approve, reject, or ask for changes on an agent application, by application id. Rejecting or asking for changes needs notes the applicant reads.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing the application decision",
  input: z.object({ applicationId: z.string().regex(UUID_RE), decision: z.enum(["approve", "reject", "request_changes"]), notes: z.string().trim().max(1000).optional() }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const parsed = reviewAgentApplicationInput.safeParse({ ...input, notes: input.notes ?? "" });
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    const word = { approve: "Approve", reject: "Reject", request_changes: "Ask for changes" }[input.decision];
    return proposed(`${word} the agent application`, {
      label: `${word}: agent application`,
      summary: input.decision === "approve" ? "Makes them an agent on Vallo and tells them." : "The applicant is told, with your notes.",
      args: { application: input.applicationId.slice(0, 8), decision: word },
      ...(parsed.data.notes ? { preview: { heading: "What the applicant will read", text: parsed.data.notes } } : {}),
      confirmLabel: word,
      confirmWord: input.decision === "approve" ? "APPROVE" : "SEND",
      mode: "act",
      deskHref: "/admin/agents",
      action: { kind: "review_agent_application", input: parsed.data },
    });
  },
});

/* ------------------------------------------------------- identity checks */

export const decideIdentity = defineTool({
  name: "decide_identity_check",
  description: "Super admin only. Approve or refuse an identity check by check id. Refusing needs a reason of twelve characters or more, which the member reads. Never tell a member you suspect fraud.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing the identity decision",
  input: z.object({ checkId: z.string().regex(UUID_RE), approve: z.boolean(), reason: z.string().trim().max(500).optional() }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const parsed = decideIdentityCheckInput.safeParse({ ...input, reason: input.reason ?? "" });
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    const word = input.approve ? "Approve identity" : "Refuse identity";
    return proposed(word, {
      label: `${word} check`,
      summary: input.approve ? "Marks the member's identity as checked." : "Refuses the check; the member is told the reason.",
      args: { check: input.checkId.slice(0, 8), decision: word },
      ...(parsed.data.reason ? { preview: { heading: "What the member will read", text: parsed.data.reason } } : {}),
      confirmLabel: word,
      confirmWord: input.approve ? "APPROVE" : "REFUSE",
      mode: "act",
      deskHref: "/admin/kyc",
      action: { kind: "decide_identity_check", input: parsed.data },
    });
  },
});

/* -------------------------------------------------------------- switches */

export const flipSwitch = defineTool({
  name: "set_switch",
  description: "Super admin only. Turn a platform switch (feature flag) on or off, by its key as the control room lists it. Read get_control_room first so you name the right key.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing the switch",
  input: z.object({ key: z.string().regex(/^[a-z0-9_]{1,64}$/), enabled: z.boolean() }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const parsed = setSwitchInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    const flags = await getFeatureFlags();
    if (flags.state !== "ok") return unreadable("The switches");
    const flag = flags.data.find((f) => f.key === input.key);
    if (!flag) return { ok: false, error: `There is no switch called ${input.key}. Read the control room and name one it lists.` };
    if (flag.enabled === input.enabled) return { ok: false, error: `${input.key} is already ${input.enabled ? "on" : "off"}.` };
    const word = input.enabled ? "Turn on" : "Turn off";
    return proposed(`${word} ${input.key}`, {
      label: `${word}: ${input.key}`,
      summary: `Changes it for everyone on the platform, at once.${flag.note ? ` What it does: ${clip(flag.note, 200)}` : ""}`,
      args: { switch: input.key, now: flag.enabled ? "on" : "off", after: input.enabled ? "on" : "off" },
      confirmLabel: word,
      confirmWord: input.enabled ? "ON" : "OFF",
      mode: "act",
      deskHref: "/admin/control",
      action: { kind: "set_switch", input: parsed.data },
    });
  },
});

/* ------------------------------------------------------------ restrictions */

export const restrict = defineTool({
  name: "restrict_member",
  description:
    "Super admin only. Restrict a member by user id: warning, messaging, posting, roommates, or suspended, for a number of days or until lifted (days null). Give the reason (ten characters or more), which is recorded on their file. Use only on facts you read; never on a guess.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing the restriction",
  input: z.object({ userId: z.string().regex(UUID_RE), kind: z.enum(["warning", "messaging", "posting", "roommates", "suspended"]), days: z.number().int().min(1).max(3650).nullable().optional(), reason: z.string().trim().max(1000) }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const parsed = restrictMemberInput.safeParse({ ...input, days: input.days ?? null });
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    const length = parsed.data.days ? `${parsed.data.days} days` : "until lifted";
    return proposed(`Restrict a member (${input.kind})`, {
      label: `Restrict: ${input.kind}`,
      summary: `Applies a ${input.kind} restriction ${length}, recorded on their file under your name.`,
      args: { member: input.userId.slice(0, 8), restriction: input.kind, length },
      preview: { heading: "The reason on their file", text: parsed.data.reason },
      confirmLabel: "Restrict",
      confirmWord: "RESTRICT",
      mode: "act",
      deskHref: `/admin/people/${input.userId}`,
      action: { kind: "restrict_member", input: parsed.data },
    });
  },
});

export const liftRestrictionTool = defineTool({
  name: "lift_restriction",
  description: "Super admin only. Lift a restriction by its restriction id, with a short reason.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing to lift the restriction",
  input: z.object({ restrictionId: z.string().regex(UUID_RE), reason: z.string().trim().max(500) }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const parsed = liftRestrictionInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    return proposed("Lift a restriction", {
      label: "Lift restriction",
      summary: "Ends the restriction now, recorded under your name.",
      args: { restriction: input.restrictionId.slice(0, 8) },
      preview: { heading: "Why", text: parsed.data.reason },
      confirmLabel: "Lift it",
      mode: "act",
      deskHref: "/admin/trust",
      action: { kind: "lift_restriction", input: parsed.data },
    });
  },
});

/* ------------------------------------------------------------- staff access */

export const grantAccess = defineTool({
  name: "grant_staff_access",
  description:
    "Super admin only. Give a person staff access by the email they sign in with: a position (as the Staff desk names them) and, if not the position's usual set, the access areas. Read get_staff_overview first.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing the access grant",
  input: z.object({ email: z.string().trim().email().max(200), position: z.string().trim().max(60).optional(), scopes: z.array(z.string()).max(20).optional(), note: z.string().trim().max(500).optional() }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const scopes = (input.scopes ?? []).filter((s) => (STAFF_SCOPES as readonly string[]).includes(s));
    const parsed = grantStaffInput.safeParse({ email: input.email, position: input.position ?? "", scopes, note: input.note ?? "" });
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    return proposed(`Grant staff access to ${input.email}`, {
      label: "Grant staff access",
      summary: "They can open the console with this access the next time they sign in.",
      args: { email: parsed.data.email, position: parsed.data.position || "none named", areas: parsed.data.scopes.length ? parsed.data.scopes.join(", ") : "the position's usual set" },
      confirmLabel: "Grant access",
      confirmWord: "GRANT",
      mode: "act",
      deskHref: "/admin/staff",
      action: { kind: "grant_staff", input: parsed.data },
    });
  },
});

export const revokeAccess = defineTool({
  name: "revoke_staff_access",
  description: "Super admin only. Take a person's staff access away, by their user id, with a reason.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing to remove access",
  input: z.object({ userId: z.string().regex(UUID_RE), reason: z.string().trim().max(500) }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    if (input.userId === ctx.viewer.userId) return { ok: false, error: "You cannot take your own access away from the copilot." };
    const parsed = revokeStaffInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    return proposed("Remove staff access", {
      label: "Remove staff access",
      summary: "Their console access ends now. Their past work stays in the audit log.",
      args: { person: input.userId.slice(0, 8) },
      preview: { heading: "Why", text: parsed.data.reason },
      confirmLabel: "Remove access",
      confirmWord: "REVOKE",
      mode: "act",
      deskHref: "/admin/staff",
      action: { kind: "revoke_staff", input: parsed.data },
    });
  },
});

/* ----------------------------------------------------------------- money */

export const refundBooking = defineTool({
  name: "refund_booking",
  description:
    "Super admin only. Refund all or part of a paid booking, by booking id, in kobo, with a reason (guest_choice, host_cancelled, not_as_listed, no_access, goodwill, duplicate_charge). The desk refuses more than was paid. Read get_bookings_overview first.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing the refund",
  input: z.object({ bookingId: z.string().regex(UUID_RE), amountMinor: z.number().int().positive(), reason: z.enum(["guest_choice", "host_cancelled", "not_as_listed", "no_access", "goodwill", "duplicate_charge"]), note: z.string().trim().max(500).optional() }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const parsed = refundBookingInput.safeParse({ ...input, note: input.note ?? "" });
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    const naira = `₦${(parsed.data.amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
    return proposed(`Refund ${naira}`, {
      label: `Refund ${naira}`,
      summary: "Sends the money back to the card that paid, through the payment partner. The guest is told.",
      args: { booking: input.bookingId.slice(0, 8), amount: naira, reason: parsed.data.reason.replace(/_/g, " ") },
      ...(parsed.data.note ? { preview: { heading: "Note on the booking", text: parsed.data.note } } : {}),
      confirmLabel: `Refund ${naira}`,
      confirmWord: "REFUND",
      mode: "act",
      deskHref: `/admin/bookings/${input.bookingId}`,
      action: { kind: "refund_booking", input: parsed.data },
    });
  },
});

/* ------------------------------------------------------------ held content */

export const decideHeld = defineTool({
  name: "decide_held_item",
  description: "Super admin only. Release or remove a post, story, comment or bio the safety scan is holding, by its id from get_moderation_queue.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  allow: superOnly,
  superAdminOnly: true,
  status: "Preparing the moderation decision",
  input: z.object({ target: z.enum(["post", "story", "comment", "bio"]), id: z.string().regex(UUID_RE), decision: z.enum(["RELEASE", "REMOVE"]), reason: z.string().trim().max(500).optional() }),
  handler: async (input, ctx) => {
    if (!(await superGate(ctx))) return refused();
    const parsed = decideHeldItemInput.safeParse({ ...input, reason: input.reason ?? "" });
    if (!parsed.success) return { ok: false, error: issue(parsed.error) };
    const word = input.decision === "RELEASE" ? "Release" : "Remove";
    return proposed(`${word} the held ${input.target}`, {
      label: `${word} held ${input.target}`,
      summary: input.decision === "RELEASE" ? "Shows it again to everyone it was meant for." : "Takes it down for good; the author is told.",
      args: { item: input.target, id: input.id.slice(0, 8), decision: word },
      ...(parsed.data.reason ? { preview: { heading: "Reason", text: parsed.data.reason } } : {}),
      confirmLabel: word,
      ...(input.decision === "REMOVE" ? { confirmWord: "REMOVE" } : {}),
      mode: "act",
      deskHref: "/admin/queue",
      action: { kind: "decide_held_item", input: parsed.data },
    });
  },
});

export const SUPER_ADMIN_TOOLS = [decideListing, decideAgentApplication, decideIdentity, flipSwitch, restrict, liftRestrictionTool, grantAccess, revokeAccess, refundBooking, decideHeld];
