"use server";

import { createHash, randomInt } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "@/lib/actions/session";
import { sendEmail } from "@/lib/email/client";
import { createAdminClient } from "@/lib/supabase/admin";

import { isNotLive } from "../degrade";
import {
  AMENITIES,
  AUTHORITIES,
  FURNISHED,
  FURNISHED_PREFS,
  GENDERS,
  GENDER_PREFS,
  INTENTS,
  LIFE_STAGES,
  LIMITS,
  LISTING_KINDS,
  MOVE_IN_FLEX,
  PERIODS,
  ROOMMATES_ROUTES,
  ROOM_PREFS,
  ROOM_TYPES,
  canPublishProfile,
  listingProblems,
  type ListingDraft,
  type MyRoommateProfile,
} from "./model";

/**
 * VALLO ROOMMATES, THE WRITES.
 *
 * Every write runs on the member's own client, so the RLS policies and the
 * database functions hold the rules (only you edit your profile, only a
 * mutual yes opens a chat, only a group's members see its shortlist). This
 * file shapes the input, checks it before the round trip, and turns the
 * database's own sentences (RM codes) into the banner's words. The only
 * service-role writes are the verification records, so a member can never
 * mark themselves verified.
 */

const NOT_OPEN = "Vallo Roommates is not open on this server yet.";
const FAILED = "That did not go through. Try again.";

type Db = SupabaseClient;

async function member(): Promise<{ db: Db; userId: string } | { error: string }> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { error: NOT_CONFIGURED_MESSAGE };
  if (session.state === "signed-out") return { error: SIGNED_OUT_MESSAGE };
  return { db: session.supabase as unknown as Db, userId: session.user.id };
}

function wordsFor(error: { code?: string; message?: string } | null): string {
  if (!error) return FAILED;
  if (isNotLive(error)) return NOT_OPEN;
  if (error.code === "54000" || error.code === "program_limit_exceeded") return "That is more than we accept in this time. Please wait a little and try again.";
  if (error.code === "23505") return "That is already done.";
  if (typeof error.code === "string" && /^RM\d{3}$/.test(error.code) && error.message) return error.message;
  return FAILED;
}

const uuid = z.string().uuid("That could not be found.");
const minor = z.number().int().nonnegative().max(1_000_000_000_00).nullable();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.").nullable();
const shortText = (max: number) => z.string().trim().max(max);

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

/* ------------------------------------------------------------------ profile */

const profileSchema = z.object({
  intents: z.array(z.enum(INTENTS)).max(4),
  intro: shortText(LIMITS.introMax),
  lifeStage: z.enum(LIFE_STAGES).nullable(),
  institutionId: uuid.nullable(),
  institutionVisible: z.boolean(),
  course: shortText(80),
  studyLevel: shortText(30),
  workplace: shortText(80),
  workplaceVisible: z.boolean(),
  nyscStateCode: z.string().length(2).nullable(),
  stateCode: z.string().length(2).nullable(),
  city: shortText(60),
  areas: z.array(shortText(60)).max(LIMITS.areasMax),
  budgetMinMinor: minor,
  budgetMaxMinor: minor,
  budgetPeriod: z.enum(PERIODS),
  moveInOn: day,
  moveInFlex: z.enum(MOVE_IN_FLEX),
  roomPref: z.enum(ROOM_PREFS).nullable(),
  furnishedPref: z.enum(FURNISHED_PREFS).nullable(),
  householdSize: z.number().int().min(2).max(8).nullable(),
  lifestyle: z.object({
    cleanliness: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    social: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    sleep: z.enum(["early", "late", "varies"]).nullable(),
    smoking: z.enum(["never", "outside", "yes"]).nullable(),
    pets: z.enum(["none", "fine", "have"]).nullable(),
    guests: z.enum(["rarely", "sometimes", "often"]).nullable(),
    cooking: z.enum(["rarely", "sometimes", "often"]).nullable(),
    schedule: z.enum(["day", "night", "mixed", "home"]).nullable(),
  }),
  gender: z.enum(GENDERS).nullable(),
  genderVisible: z.boolean(),
  genderPref: z.enum(GENDER_PREFS),
});

/**
 * Save the roommate profile. `publish` makes it live (it must have the
 * minimum: what you want, a city and a budget); otherwise it keeps its
 * current status, so editing a live profile keeps it live.
 */
export async function saveRoommateProfile(
  input: Omit<MyRoommateProfile, "status">,
  options: { publish?: boolean } = {},
): Promise<ActionResult<{ status: MyRoommateProfile["status"] }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(profileSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const p = parsed.data;
  if (p.budgetMinMinor !== null && p.budgetMaxMinor !== null && p.budgetMinMinor > p.budgetMaxMinor) {
    return fail("Your lowest budget is higher than your highest.", { budgetMinMinor: "Lower than the highest, please." });
  }
  if (options.publish && !canPublishProfile({ ...p, status: "draft" })) {
    return fail("Add what you are looking for, a city and a budget to go live.");
  }

  const { data: existing } = await who.db.from("roommate_profiles").select("status").eq("user_id", who.userId).maybeSingle();
  const current = (existing as { status?: MyRoommateProfile["status"] } | null)?.status ?? null;
  if (current === "held") return fail("Your profile is with our team for review.");
  const status: MyRoommateProfile["status"] = options.publish ? "active" : (current ?? "draft");

  const row = {
    user_id: who.userId,
    status,
    intents: p.intents,
    intro: p.intro || null,
    life_stage: p.lifeStage,
    institution_id: p.institutionId,
    institution_visible: p.institutionVisible,
    course: p.course || null,
    study_level: p.studyLevel || null,
    workplace: p.workplace || null,
    workplace_visible: p.workplaceVisible,
    nysc_state_code: p.nyscStateCode,
    state_code: p.stateCode,
    city: p.city || null,
    areas: p.areas.filter(Boolean),
    budget_min_minor: p.budgetMinMinor,
    budget_max_minor: p.budgetMaxMinor,
    budget_period: p.budgetPeriod,
    move_in_on: p.moveInOn,
    move_in_flex: p.moveInFlex,
    room_pref: p.roomPref,
    furnished_pref: p.furnishedPref,
    household_size: p.householdSize,
    ...p.lifestyle,
    gender: p.gender,
    gender_visible: p.genderVisible,
    gender_pref: p.genderPref,
    last_active_at: new Date().toISOString(),
  };
  const { error } = await who.db.from("roommate_profiles").upsert(row, { onConflict: "user_id" });
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.home, ROOMMATES_ROUTES.profile, ROOMMATES_ROUTES.hub);
  return ok({ status });
}

/** Pause or turn back on. A held profile stays held (the database refuses). */
export async function setRoommateProfileStatus(status: "active" | "paused"): Promise<ActionResult<{ status: "active" | "paused" }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (status !== "active" && status !== "paused") return fail(FAILED);
  const { error } = await who.db.from("roommate_profiles").update({ status }).eq("user_id", who.userId);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.home, ROOMMATES_ROUTES.hub, ROOMMATES_ROUTES.profile);
  return ok({ status });
}

/** Delete the roommate profile (the Vallo account stays). Interests and memberships go with it. */
export async function deleteRoommateProfile(): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const { error } = await who.db.from("roommate_profiles").delete().eq("user_id", who.userId);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.home, ROOMMATES_ROUTES.hub);
  return ok(null);
}

/* ------------------------------------------------------------------ listings */

const listingSchema = z.object({
  id: uuid.nullable(),
  kind: z.enum(LISTING_KINDS),
  title: z.string().trim().min(LIMITS.titleMin, "Give it a title of 8 letters or more.").max(LIMITS.titleMax, "Keep the title to 120 characters."),
  description: shortText(LIMITS.descriptionMax),
  stateCode: z.string().length(2).nullable(),
  city: z.string().trim().min(2, "Which city is it in?").max(60),
  area: shortText(80),
  institutionId: uuid.nullable(),
  linkedListingId: uuid.nullable(),
  rentMinor: minor,
  rentPeriod: z.enum(PERIODS),
  shareMinor: minor,
  depositMinor: minor,
  agencyFeeMinor: minor,
  legalFeeMinor: minor,
  serviceChargeMinor: minor,
  utilitiesMonthlyMinor: minor,
  roomsAvailable: z.number().int().min(0).max(20).nullable(),
  occupantsNow: z.number().int().min(0).max(20).nullable(),
  occupantsMax: z.number().int().min(1).max(20).nullable(),
  bedrooms: z.number().int().min(0).max(20).nullable(),
  bathrooms: z.number().int().min(0).max(20).nullable(),
  roomType: z.enum(ROOM_TYPES).nullable(),
  furnished: z.enum(FURNISHED).nullable(),
  amenities: z.array(z.enum(AMENITIES)).max(24),
  houseRules: z.array(z.string().trim().min(1).max(LIMITS.ruleMax, "Keep each rule short.")).max(LIMITS.rulesMax, "Ten rules at most."),
  availableFrom: day,
  minStayMonths: z.number().int().min(1).max(60).nullable(),
  genderPref: z.enum(GENDER_PREFS),
  photos: z.array(z.string().min(3).max(300)).max(LIMITS.photosMax, "Twelve photos at most."),
  authority: z.enum(AUTHORITIES).nullable(),
  declared: z.boolean(),
});

/**
 * Create or update a roommate post. `publish` sends it live (the checks of
 * `listingProblems` first, then the database's own shape check); otherwise it
 * is saved as a draft, or keeps its status when it is already live.
 */
export async function saveRoommateListing(input: ListingDraft, options: { publish?: boolean } = {}): Promise<ActionResult<{ id: string; status: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(listingSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  if (options.publish) {
    const problems = listingProblems(d);
    if (problems.includes("rent")) return fail("Add the rent to publish a room.", { rentMinor: "Add the rent." });
    if (problems.includes("authority")) return fail("Tell us who you are to this home.", { authority: "Choose one." });
    if (problems.includes("declared")) return fail("Confirm you have the right to offer this room.", { declared: "Tick to confirm." });
    if (problems.length) return fail("Some details are missing.");
    /* Only the photo paths in the member's own folder are accepted. */
    if (d.photos.some((p) => !p.startsWith(`${who.userId}/`))) return fail("One of the photos could not be used. Upload it again.");
  }

  let status: string = options.publish ? "live" : "draft";
  if (d.id && !options.publish) {
    const { data: cur } = await who.db.from("roommate_listings").select("status").eq("id", d.id).maybeSingle();
    const s = (cur as { status?: string } | null)?.status;
    if (s && s !== "draft") status = s;
  }

  const row = {
    kind: d.kind,
    status,
    title: d.title,
    description: d.description,
    state_code: d.stateCode,
    city: d.city,
    area: d.area || null,
    institution_id: d.institutionId,
    listing_id: d.linkedListingId,
    rent_minor: d.rentMinor,
    rent_period: d.rentPeriod,
    share_minor: d.shareMinor,
    deposit_minor: d.depositMinor,
    agency_fee_minor: d.agencyFeeMinor,
    legal_fee_minor: d.legalFeeMinor,
    service_charge_minor: d.serviceChargeMinor,
    utilities_monthly_minor: d.utilitiesMonthlyMinor,
    rooms_available: d.roomsAvailable,
    occupants_now: d.occupantsNow,
    occupants_max: d.occupantsMax,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    room_type: d.roomType,
    furnished: d.furnished,
    amenities: d.amenities,
    house_rules: d.houseRules,
    available_from: d.availableFrom,
    min_stay_months: d.minStayMonths,
    gender_pref: d.genderPref,
    photos: d.photos,
    authority: d.kind === "room_offer" ? d.authority : null,
    authority_declared_at: d.kind === "room_offer" && d.declared ? new Date().toISOString() : null,
  };

  if (d.id) {
    const { error } = await who.db.from("roommate_listings").update(row).eq("id", d.id).eq("owner_id", who.userId);
    if (error) return fail(wordsFor(error));
    refresh(ROOMMATES_ROUTES.listing(d.id), ROOMMATES_ROUTES.hub, ROOMMATES_ROUTES.home);
    return ok({ id: d.id, status });
  }
  const { data, error } = await who.db.from("roommate_listings").insert({ ...row, owner_id: who.userId }).select("id").single();
  if (error || !data) return fail(wordsFor(error));
  const id = (data as { id: string }).id;
  refresh(ROOMMATES_ROUTES.hub, ROOMMATES_ROUTES.home);
  return ok({ id, status });
}

export async function setRoommateListingStatus(input: { id: string; status: "live" | "paused" | "filled" }): Promise<ActionResult<{ status: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.id).success || !["live", "paused", "filled"].includes(input.status)) return fail(FAILED);
  const { error } = await who.db.from("roommate_listings").update({ status: input.status }).eq("id", input.id).eq("owner_id", who.userId);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.listing(input.id), ROOMMATES_ROUTES.hub);
  return ok({ status: input.status });
}

export async function deleteRoommateListing(id: string): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(id).success) return fail(FAILED);
  const { error } = await who.db.from("roommate_listings").delete().eq("id", id).eq("owner_id", who.userId);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.hub, ROOMMATES_ROUTES.home);
  return ok(null);
}

/** Count a view once per viewer per day (the database dedups). Never fails the page. */
export async function recordRoommateListingView(id: string): Promise<void> {
  if (!uuid.safeParse(id).success) return;
  const who = await member();
  if ("error" in who) return;
  await who.db.rpc("roommate_record_view", { p_listing: id });
}

/* ------------------------------------------------------------------ interests and connections */

async function call<T>(db: Db, fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await db.rpc(fn, args);
  if (error) return { data: null, error: wordsFor(error) };
  return { data: data as T, error: null };
}

export async function expressInterest(input: { toId: string; listingId?: string | null; note?: string }): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.toId).success) return fail("That person could not be found.");
  if (input.toId === who.userId) return fail("That is you.");
  const note = (input.note ?? "").trim().slice(0, LIMITS.noteMax);
  const res = await call<string>(who.db, "roommate_express_interest", {
    p_to: input.toId,
    p_listing: input.listingId && uuid.safeParse(input.listingId).success ? input.listingId : null,
    p_note: note || null,
  });
  if (res.error || !res.data) return fail(res.error ?? FAILED);
  refresh(ROOMMATES_ROUTES.person(input.toId), ROOMMATES_ROUTES.hub);
  if (input.listingId) refresh(ROOMMATES_ROUTES.listing(input.listingId));
  return ok({ id: res.data });
}

export async function answerInterest(input: { id: string; accept: boolean }): Promise<ActionResult<{ status: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.id).success) return fail(FAILED);
  const res = await call<string>(who.db, "roommate_answer_interest", { p_id: input.id, p_accept: Boolean(input.accept) });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.hub);
  return ok({ status: res.data ?? (input.accept ? "accepted" : "declined") });
}

export async function withdrawInterest(id: string): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(id).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_withdraw_interest", { p_id: id });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.hub);
  return ok(null);
}

export async function endConnection(id: string): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(id).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_end_connection", { p_id: id });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.hub);
  return ok(null);
}

/** Open (or find) the chat for an accepted connection, in Vallo's own messages. */
export async function openRoommateChat(interestId: string): Promise<ActionResult<{ conversationId: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(interestId).success) return fail(FAILED);
  const res = await call<string>(who.db, "roommate_open_chat", { p_interest: interestId });
  if (res.error || !res.data) return fail(res.error ?? "We could not open this chat just now. Please try again.");
  return ok({ conversationId: res.data });
}

/* ------------------------------------------------------------------ groups */

const groupSchema = z.object({
  name: z.string().trim().min(LIMITS.groupNameMin, "Give the group a name of 3 letters or more.").max(LIMITS.groupNameMax, "Keep the name to 60 characters."),
  intro: shortText(LIMITS.groupIntroMax),
  visibility: z.enum(["private", "open"]),
  stateCode: z.string().length(2).nullable(),
  city: shortText(60),
  areas: z.array(shortText(60)).max(LIMITS.areasMax),
  institutionId: uuid.nullable(),
  bedrooms: z.number().int().min(1).max(10).nullable(),
  sizeTarget: z.number().int().min(2).max(8),
  budgetMinMinor: minor,
  budgetMaxMinor: minor,
  budgetPeriod: z.enum(PERIODS),
  moveInOn: day,
});
export type GroupInput = z.input<typeof groupSchema>;

export async function createRoommateGroup(input: GroupInput): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(groupSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const res = await call<string>(who.db, "roommate_create_group", { p: parsed.data });
  if (res.error || !res.data) return fail(res.error ?? FAILED);
  refresh(ROOMMATES_ROUTES.hub, ROOMMATES_ROUTES.groups);
  return ok({ id: res.data });
}

export async function updateRoommateGroup(id: string, input: GroupInput & { stage?: "forming" | "searching" | "decided" | "living" | "closed" }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(id).success) return fail(FAILED);
  const parsed = validate(groupSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const g = parsed.data;
  const { error } = await who.db
    .from("roommate_groups")
    .update({
      name: g.name,
      intro: g.intro || null,
      visibility: g.visibility,
      state_code: g.stateCode,
      city: g.city || null,
      areas: g.areas,
      institution_id: g.institutionId,
      bedrooms: g.bedrooms,
      size_target: g.sizeTarget,
      budget_min_minor: g.budgetMinMinor,
      budget_max_minor: g.budgetMaxMinor,
      budget_period: g.budgetPeriod,
      move_in_on: g.moveInOn,
      ...(input.stage ? { stage: input.stage } : {}),
    })
    .eq("id", id);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.group(id));
  return ok(null);
}

export async function setGroupStage(id: string, stage: "forming" | "searching" | "decided" | "living" | "closed"): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(id).success) return fail(FAILED);
  const { error } = await who.db.from("roommate_groups").update({ stage }).eq("id", id);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.group(id), ROOMMATES_ROUTES.hub);
  return ok(null);
}

export async function inviteToGroup(input: { groupId: string; userId: string }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.groupId).success || !uuid.safeParse(input.userId).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_invite_to_group", { p_group: input.groupId, p_user: input.userId });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

export async function answerGroupInvite(input: { groupId: string; accept: boolean }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.groupId).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_answer_group_invite", { p_group: input.groupId, p_accept: Boolean(input.accept) });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.hub, ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

export async function requestToJoinGroup(groupId: string): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(groupId).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_request_join_group", { p_group: groupId });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.group(groupId), ROOMMATES_ROUTES.hub);
  return ok(null);
}

export async function answerJoinRequest(input: { groupId: string; userId: string; accept: boolean }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.groupId).success || !uuid.safeParse(input.userId).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_answer_join_request", { p_group: input.groupId, p_user: input.userId, p_accept: Boolean(input.accept) });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(groupId).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_leave_group", { p_group: groupId });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.hub);
  return ok(null);
}

export async function removeGroupMember(input: { groupId: string; userId: string }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.groupId).success || !uuid.safeParse(input.userId).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_remove_member", { p_group: input.groupId, p_user: input.userId });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

export async function setMemberShare(input: { groupId: string; userId: string; percent: number | null }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.groupId).success || !uuid.safeParse(input.userId).success) return fail(FAILED);
  const percent = input.percent === null ? null : Math.max(0, Math.min(100, Math.round(input.percent * 100) / 100));
  const res = await call<null>(who.db, "roommate_set_share", { p_group: input.groupId, p_user: input.userId, p_percent: percent });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

export async function addToGroupShortlist(input: { groupId: string; listingId?: string | null; roommateListingId?: string | null; note?: string }): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.groupId).success) return fail(FAILED);
  const listing = input.listingId && uuid.safeParse(input.listingId).success ? input.listingId : null;
  const room = input.roommateListingId && uuid.safeParse(input.roommateListingId).success ? input.roommateListingId : null;
  if (!listing === !room) return fail(FAILED);
  const { data, error } = await who.db
    .from("roommate_group_shortlist")
    .insert({ group_id: input.groupId, listing_id: listing, roommate_listing_id: room, added_by: who.userId, note: input.note?.trim().slice(0, LIMITS.noteMax) || null })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail("That home is already on the group's shortlist.");
    return fail(wordsFor(error));
  }
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok({ id: (data as { id: string }).id });
}

export async function removeFromGroupShortlist(input: { groupId: string; id: string }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.id).success) return fail(FAILED);
  const { error } = await who.db.from("roommate_group_shortlist").delete().eq("id", input.id);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

export async function voteOnShortlist(input: { groupId: string; shortlistId: string; vote: "yes" | "maybe" | "no" | null }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.shortlistId).success) return fail(FAILED);
  if (input.vote === null) {
    const { error } = await who.db.from("roommate_group_votes").delete().eq("shortlist_id", input.shortlistId).eq("user_id", who.userId);
    if (error) return fail(wordsFor(error));
  } else {
    if (!["yes", "maybe", "no"].includes(input.vote)) return fail(FAILED);
    const { error } = await who.db
      .from("roommate_group_votes")
      .upsert({ shortlist_id: input.shortlistId, user_id: who.userId, vote: input.vote }, { onConflict: "shortlist_id,user_id" });
    if (error) return fail(wordsFor(error));
  }
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

export async function postToGroup(input: { groupId: string; body: string }): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const body = (input.body ?? "").trim();
  if (!body) return fail("Write something first.", { body: "Write something first." });
  if (body.length > LIMITS.postMax) return fail("Keep it to 1,000 characters.");
  const res = await call<string>(who.db, "roommate_post_to_group", { p_group: input.groupId, p_body: body });
  if (res.error || !res.data) return fail(res.error ?? FAILED);
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok({ id: res.data });
}

export async function deleteGroupPost(input: { groupId: string; id: string }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const { error } = await who.db.from("roommate_group_posts").delete().eq("id", input.id);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

const expenseSchema = z.object({
  groupId: uuid,
  title: z.string().trim().min(2, "Name the cost.").max(80),
  amountMinor: z.number().int().positive("Enter an amount."),
  paidBy: uuid.nullable(),
  dueOn: day,
  status: z.enum(["planned", "recorded", "settled"]),
});

export async function addGroupExpense(input: z.input<typeof expenseSchema>): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(expenseSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const e = parsed.data;
  const { data, error } = await who.db
    .from("roommate_group_expenses")
    .insert({ group_id: e.groupId, title: e.title, amount_minor: e.amountMinor, paid_by: e.paidBy, due_on: e.dueOn, status: e.status, created_by: who.userId })
    .select("id")
    .single();
  if (error || !data) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.group(e.groupId));
  return ok({ id: (data as { id: string }).id });
}

export async function setGroupExpenseStatus(input: { groupId: string; id: string; status: "planned" | "recorded" | "settled" }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!["planned", "recorded", "settled"].includes(input.status)) return fail(FAILED);
  const { error } = await who.db.from("roommate_group_expenses").update({ status: input.status }).eq("id", input.id);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

export async function deleteGroupExpense(input: { groupId: string; id: string }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const { error } = await who.db.from("roommate_group_expenses").delete().eq("id", input.id);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.group(input.groupId));
  return ok(null);
}

/* ------------------------------------------------------------------ viewings */

const viewingSchema = z.object({
  listingId: uuid,
  mode: z.enum(["in_person", "virtual"]),
  proposedAt: z.string().datetime({ offset: true, message: "Choose a day and time." }),
  altAt: z.string().datetime({ offset: true }).nullable(),
  note: shortText(LIMITS.noteMax),
});

export async function requestRoommateViewing(input: z.input<typeof viewingSchema>): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(viewingSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const v = parsed.data;
  if (Date.parse(v.proposedAt) < Date.now() + 30 * 60 * 1000) return fail("Choose a time at least half an hour from now.", { proposedAt: "A little later, please." });
  const res = await call<string>(who.db, "roommate_request_viewing", {
    p_listing: v.listingId,
    p_mode: v.mode,
    p_at: v.proposedAt,
    p_alt: v.altAt,
    p_note: v.note || null,
  });
  if (res.error || !res.data) return fail(res.error ?? FAILED);
  refresh(ROOMMATES_ROUTES.listing(v.listingId), ROOMMATES_ROUTES.hub);
  return ok({ id: res.data });
}

export async function answerRoommateViewing(input: { id: string; confirm: boolean; at?: string | null }): Promise<ActionResult<{ status: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.id).success) return fail(FAILED);
  const res = await call<string>(who.db, "roommate_answer_viewing", { p_id: input.id, p_confirm: Boolean(input.confirm), p_at: input.at ?? null });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.hub);
  return ok({ status: res.data ?? (input.confirm ? "confirmed" : "declined") });
}

export async function cancelRoommateViewing(id: string): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(id).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_cancel_viewing", { p_id: id });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.hub);
  return ok(null);
}

export async function markRoommateViewingDone(id: string): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(id).success) return fail(FAILED);
  const res = await call<null>(who.db, "roommate_viewing_done", { p_id: id });
  if (res.error) return fail(res.error);
  refresh(ROOMMATES_ROUTES.hub);
  return ok(null);
}

/* ------------------------------------------------------------------ saved searches */

const searchSchema = z.object({
  label: z.string().trim().min(2, "Name the search.").max(80),
  kind: z.enum(LISTING_KINDS).nullable(),
  stateCode: z.string().length(2).nullable(),
  city: z.string().trim().max(60).nullable(),
  institutionId: uuid.nullable(),
  maxMinor: minor,
  period: z.enum(PERIODS),
  alert: z.boolean(),
});

export async function saveRoommateSearch(input: z.input<typeof searchSchema>): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(searchSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const s = parsed.data;
  const { data, error } = await who.db
    .from("roommate_saved_searches")
    .insert({ user_id: who.userId, label: s.label, kind: s.kind, state_code: s.stateCode, city: s.city || null, institution_id: s.institutionId, max_minor: s.maxMinor, period: s.period, alert: s.alert })
    .select("id")
    .single();
  if (error || !data) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.hub);
  return ok({ id: (data as { id: string }).id });
}

export async function setRoommateSearchAlert(input: { id: string; alert: boolean }): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const { error } = await who.db.from("roommate_saved_searches").update({ alert: Boolean(input.alert) }).eq("id", input.id).eq("user_id", who.userId);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.hub);
  return ok(null);
}

export async function deleteRoommateSearch(id: string): Promise<ActionResult> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const { error } = await who.db.from("roommate_saved_searches").delete().eq("id", id).eq("user_id", who.userId);
  if (error) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.hub);
  return ok(null);
}

/* ------------------------------------------------------------------ verification */

function hashCode(code: string, id: string): string {
  return createHash("sha256").update(`${id}:${code}`).digest("hex");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your school email";
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}${"*".repeat(Math.max(1, Math.min(6, local.length - keep.length)))}@${domain}`;
}

/** Does this address belong to one of the school's own email domains (or a subdomain)? */
function emailFitsDomains(email: string, domains: string[]): boolean {
  const host = email.split("@")[1]?.toLowerCase() ?? "";
  return domains.some((d) => {
    const dd = d.toLowerCase().replace(/^@/, "");
    return host === dd || host.endsWith(`.${dd}`);
  });
}

/**
 * Start the school email check: the address must be on one of the school's
 * own domains (the institutions directory holds them, checked against each
 * school's public website), then a 6 digit code goes to it. The record and
 * the code are written with the service role, so nobody can mark
 * themselves verified.
 */
export async function startSchoolEmailCheck(input: { institutionId: string; email: string }): Promise<ActionResult<{ verificationId: string; sentTo: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.institutionId).success) return fail("Choose your school.", { institutionId: "Choose your school." });
  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return fail("Enter your school email address.", { email: "Enter your school email address." });

  const admin = createAdminClient() as unknown as Db;
  const { data: inst, error: instErr } = await admin.from("institutions").select("id, name, email_domains, email_verify_on").eq("id", input.institutionId).maybeSingle();
  if (instErr) return fail(wordsFor(instErr));
  const school = inst as { id: string; name: string; email_domains: string[]; email_verify_on: boolean } | null;
  if (!school) return fail("Choose your school.");
  if (!school.email_verify_on || school.email_domains.length === 0) {
    return fail(`We cannot check ${school.name} emails yet. Upload your student ID instead.`);
  }
  if (!emailFitsDomains(email, school.email_domains)) {
    return fail(`Use an email address ending in ${school.email_domains[0]}.`, { email: `It should end in ${school.email_domains[0]}.` });
  }

  /* At most three codes an hour per member. */
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("roommate_verifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", who.userId)
    .eq("kind", "student_email")
    .gte("created_at", since);
  if ((count ?? 0) >= 3) return fail("You have asked for three codes this hour. Try again a little later.");

  const { data: rec, error: recErr } = await admin
    .from("roommate_verifications")
    .insert({ user_id: who.userId, kind: "student_email", institution_id: school.id, email_masked: maskEmail(email), status: "pending" })
    .select("id")
    .single();
  if (recErr || !rec) return fail(wordsFor(recErr));
  const verificationId = (rec as { id: string }).id;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error: codeErr } = await admin
    .from("roommate_email_codes")
    .insert({ verification_id: verificationId, code_hash: hashCode(code, verificationId), expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
  if (codeErr) return fail(wordsFor(codeErr));

  const sent = await sendEmail({
    to: email,
    subject: `Your Vallo code: ${code}`,
    text: `Your code to confirm your ${school.name} email on Vallo Roommates is ${code}. It works for 15 minutes. If you did not ask for this, you can ignore this email.`,
    html: `<p>Your code to confirm your ${school.name} email on Vallo Roommates is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It works for 15 minutes. If you did not ask for this, you can ignore this email.</p>`,
  });
  if (!sent.sent) {
    await admin.from("roommate_verifications").update({ status: "expired", reason: "The email could not be sent." }).eq("id", verificationId);
    return fail("We could not send the email just now. Check the address and try again.");
  }
  return ok({ verificationId, sentTo: maskEmail(email) });
}

export async function confirmSchoolEmail(input: { verificationId: string; code: string }): Promise<ActionResult<{ status: "verified" }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.verificationId).success) return fail(FAILED);
  const code = (input.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) return fail("Enter the 6 digit code.", { code: "Enter the 6 digit code." });

  const admin = createAdminClient() as unknown as Db;
  const { data: rec } = await admin.from("roommate_verifications").select("id, user_id, status").eq("id", input.verificationId).maybeSingle();
  const r = rec as { id: string; user_id: string; status: string } | null;
  if (!r || r.user_id !== who.userId) return fail(FAILED);
  if (r.status !== "pending") return fail("This code has already been used. Ask for a new one.");
  const { data: row } = await admin.from("roommate_email_codes").select("code_hash, attempts, expires_at").eq("verification_id", r.id).maybeSingle();
  const c = row as { code_hash: string; attempts: number; expires_at: string } | null;
  if (!c || Date.parse(c.expires_at) < Date.now()) {
    await admin.from("roommate_verifications").update({ status: "expired" }).eq("id", r.id);
    return fail("That code has expired. Ask for a new one.");
  }
  if (c.attempts >= 5) {
    await admin.from("roommate_verifications").update({ status: "expired" }).eq("id", r.id);
    return fail("Too many tries. Ask for a new code.");
  }
  if (c.code_hash !== hashCode(code, r.id)) {
    await admin.from("roommate_email_codes").update({ attempts: c.attempts + 1 }).eq("verification_id", r.id);
    return fail("That code is not right. Check the email and try again.", { code: "Not right, try again." });
  }
  const { error } = await admin
    .from("roommate_verifications")
    .update({ status: "verified", reviewed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString() })
    .eq("id", r.id);
  if (error) return fail(wordsFor(error));
  await admin.from("roommate_email_codes").delete().eq("verification_id", r.id);
  refresh(ROOMMATES_ROUTES.verify, ROOMMATES_ROUTES.hub);
  return ok({ status: "verified" });
}

/**
 * Send a student ID, NYSC call-up letter or work letter for review. The file
 * was uploaded by the member into their own folder of the private
 * `roommate-evidence` bucket; staff read it through a short signed link.
 */
export async function submitRoommateDocument(input: { kind: "student_id" | "nysc" | "workplace"; institutionId?: string | null; path: string }): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!["student_id", "nysc", "workplace"].includes(input.kind)) return fail(FAILED);
  if (typeof input.path !== "string" || !input.path.startsWith(`${who.userId}/`) || input.path.length > 300) return fail("Upload the document again.");
  if (input.institutionId && !uuid.safeParse(input.institutionId).success) return fail("Choose your school.");
  const admin = createAdminClient() as unknown as Db;
  const { data: open } = await admin
    .from("roommate_verifications")
    .select("id")
    .eq("user_id", who.userId)
    .eq("kind", input.kind)
    .eq("status", "review")
    .limit(1);
  if ((open ?? []).length > 0) return fail("We already have one with our team. We will let you know.");
  const { data, error } = await admin
    .from("roommate_verifications")
    .insert({ user_id: who.userId, kind: input.kind, institution_id: input.institutionId ?? null, evidence_path: input.path, status: "review" })
    .select("id")
    .single();
  if (error || !data) return fail(wordsFor(error));
  refresh(ROOMMATES_ROUTES.verify, ROOMMATES_ROUTES.hub);
  return ok({ id: (data as { id: string }).id });
}

/* ------------------------------------------------------------------ feed */

/** Share a live roommate post to the Vallo feed with a line of your own (its own card there). */
export async function shareRoommateListingToFeed(input: { listingId: string; body?: string }): Promise<ActionResult<{ postId: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  if (!uuid.safeParse(input.listingId).success) return fail(FAILED);
  const body = (input.body ?? "").trim();
  if (body.length > 2000) return fail("Keep it to 2,000 characters.");
  const res = await call<string>(who.db, "roommate_share_to_feed", { p_listing: input.listingId, p_body: body || null });
  if (res.error || !res.data) return fail(res.error ?? FAILED);
  refresh("/around");
  return ok({ postId: res.data });
}
