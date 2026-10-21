import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSession } from "../actions/session";
import { callableNumbersFor } from "../security/counterpart-contact";
import { createAdminClient } from "../supabase/admin";
import { reportReadError } from "../observability/read-error";
import { toBadgeTier, type BadgeTier } from "../trust/badge-tier";
import { videoCallsOn } from "../calls/flags";
import { readViewingSlots } from "../viewings/queries";
import type { InspectionOutcome, InspectionState } from "./types";
import { listerRoleWord, NO_REMINDERS, STRIP_DAYS, visitModeOf, type OpenSlot, type VisitLister, type VisitReminders, type VisitRow } from "./visit";

/**
 * THE READS BEHIND SCHEDULE A VISIT.
 *
 * Two questions, each through the caller's own session first:
 *
 *   readVisitPlanner   "can I book this home, with whom, and when"
 *   readVisit          "where does my visit stand"
 *
 * Row-level security answers who may see what. The service role is used in
 * exactly two places, both AFTER the caller's own read has proven they are the
 * requester: the renter's reminder rows in `public.viewing_reminders`, which
 * no member's client may read, so the timeline can mark "Reminder sent" from
 * the time it actually went rather than guess; and the booked window's slot
 * length (`readSlotMinutes`), which RLS answers to the lister only. The lister's number goes
 * through `callableNumbersFor`, the one module that decides who may be handed
 * whose (a block either way, or any failure, withholds it).
 *
 * A failed read is said as a failure (`slots: null`), never as "no times".
 */

export type { VisitLister };

type ProfileRow = {
  user_id: string;
  display_label: string | null;
  handle: string | null;
  avatar_path: string | null;
  supply_role: string | null;
};

function nameOf(row: Pick<ProfileRow, "display_label" | "handle"> | null): string | null {
  if (!row) return null;
  const name = (row.display_label ?? "").trim() || (row.handle ? `@${row.handle}` : "");
  return name.length > 0 ? name : null;
}

/** An avatar the image component may load: https or a same-origin path. */
function photoOf(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("https://") || (path.startsWith("/") && !path.startsWith("//")) ? path : null;
}

async function readTier(supabase: SupabaseClient, userId: string): Promise<BadgeTier> {
  try {
    const { data } = await supabase.from("person_badge").select("tier").eq("user_id", userId).maybeSingle();
    return toBadgeTier((data as { tier?: unknown } | null)?.tier);
  } catch {
    return "none";
  }
}

/* ------------------------------------------------------------- step 1 */

export type VisitPlanner =
  | { state: "signed-out" }
  | { state: "own" }
  | { state: "existing"; inspectionId: string }
  | {
      state: "ready";
      lister: VisitLister;
      /** The lister's open slots for the next 14 days; null when the read failed. */
      slots: OpenSlot[] | null;
      videoOn: boolean;
      /** The thread already open with this lister about this home, for the in-app call. */
      conversationId: string | null;
    };

/**
 * Everything step 1 needs beyond the listing itself.
 *
 * `listingRole` and `listerName` come from the listing read the page already
 * made (`listing_lister`, published); the person behind the listing is found
 * through `listings.agent_id` and the public projection
 * `social_profiles.agent_id`, both readable to any signed-in member.
 */
export async function readVisitPlanner(
  listingId: string,
  fallback: { listerName: string | null; listingRole: string | null },
): Promise<VisitPlanner> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return { state: "signed-out" };
  const db = session.supabase as unknown as SupabaseClient;
  const me = session.user.id;

  /* A live request already: the status screen says where it stands, rather
     than this screen offering a second one the action would refuse. */
  const { data: live } = await db
    .from("inspection_requests")
    .select("id")
    .eq("listing_id", listingId)
    .eq("requester_id", me)
    .in("state", ["REQUESTED", "PROPOSED", "CONFIRMED"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (live) return { state: "existing", inspectionId: (live as { id: string }).id };

  const { data: listingRow, error: listingError } = await db
    .from("listings")
    .select("agent_id")
    .eq("id", listingId)
    .maybeSingle();
  await reportReadError("read.visit.listing", listingError);
  const agentId = (listingRow as { agent_id?: string | null } | null)?.agent_id ?? null;

  /* `agents` answers a member only their own row (`agents_select_own`), so
     a row coming back means this home is theirs. */
  if (agentId) {
    const { data: mine } = await db.from("agents").select("id").eq("id", agentId).maybeSingle();
    if (mine) return { state: "own" };
  }

  const profile = agentId
    ? (((
        await db
          .from("social_profiles")
          .select("user_id, display_label, handle, avatar_path, supply_role")
          .eq("agent_id", agentId)
          .maybeSingle()
      ).data ?? null) as ProfileRow | null)
    : null;

  const [slots, videoOn, tier, thread] = await Promise.all([
    readViewingSlots(listingId, STRIP_DAYS),
    videoCallsOn(),
    profile ? readTier(db, profile.user_id) : Promise.resolve<BadgeTier>("none"),
    profile
      ? db
          .from("conversations")
          .select("id")
          .eq("listing_id", listingId)
          .eq("guest_id", me)
          .eq("agent_id", profile.user_id)
          .limit(1)
          .maybeSingle()
          .then((answer) => ((answer.data as { id?: string } | null)?.id ?? null))
      : Promise.resolve(null),
  ]);

  return {
    state: "ready",
    lister: {
      name: nameOf(profile) ?? fallback.listerName,
      photoUrl: photoOf(profile?.avatar_path ?? null),
      role: listerRoleWord(profile?.supply_role ?? null, fallback.listingRole),
      tier,
      handle: profile?.handle ?? null,
      phone: null,
    },
    slots,
    videoOn,
    conversationId: thread,
  };
}

/* ------------------------------------------------------------- step 2 */

export type VisitRecord =
  | { state: "signed-out" }
  | { state: "missing" }
  /** The reader is the lister: this screen is the renter's. */
  | { state: "lister" }
  | {
      state: "ready";
      row: VisitRow;
      lister: VisitLister;
      reminders: VisitReminders;
      videoOn: boolean;
    };

type InspectionRow = {
  id: string;
  listing_id: string;
  requester_id: string;
  lister_id: string;
  state: InspectionState;
  requested_at: string;
  slot_at: string | null;
  note: string | null;
  lister_note: string | null;
  created_at: string;
  responded_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  outcome: InspectionOutcome | null;
  visit_mode: string | null;
  conversation_id: string | null;
  window_id: string | null;
};

const VISIT_COLUMNS =
  "id, listing_id, requester_id, lister_id, state, requested_at, slot_at, note, lister_note, created_at, responded_at, confirmed_at, completed_at, outcome, visit_mode, conversation_id, window_id";

/**
 * One visit, for the renter who asked for it. `inspection_requests_select_party`
 * answers the lister too; the lister is told to answer it from their own
 * screen rather than being shown the renter's.
 */
export async function readVisit(listingId: string, inspectionId: string): Promise<VisitRecord> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return { state: "signed-out" };
  const db = session.supabase as unknown as SupabaseClient;
  const me = session.user.id;

  const { data, error } = await db
    .from("inspection_requests")
    .select(VISIT_COLUMNS)
    .eq("id", inspectionId)
    .eq("listing_id", listingId)
    .maybeSingle();
  await reportReadError("read.visit.inspection", error);
  if (error) throw new Error("The visit could not be read.");
  const row = data as InspectionRow | null;
  if (!row) return { state: "missing" };
  if (row.requester_id !== me) return row.lister_id === me ? { state: "lister" } : { state: "missing" };

  const [profile, tier, numbers, minutes, reminders, videoOn] = await Promise.all([
    db
      .from("social_profiles")
      .select("user_id, display_label, handle, avatar_path, supply_role")
      .eq("user_id", row.lister_id)
      .maybeSingle()
      .then((answer) => (answer.data ?? null) as ProfileRow | null),
    readTier(db, row.lister_id),
    callableNumbersFor(me, [row.lister_id]),
    readSlotMinutes(row.window_id),
    readRenterReminders(row.id, row.slot_at),
    videoCallsOn(),
  ]);

  const { data: listingRow } = await db.from("listings").select("listing_role").eq("id", listingId).maybeSingle();

  return {
    state: "ready",
    row: {
      id: row.id,
      listingId: row.listing_id,
      state: row.state,
      requestedAt: row.requested_at,
      slotAt: row.slot_at,
      note: row.note,
      listerNote: row.lister_note,
      createdAt: row.created_at,
      respondedAt: row.responded_at,
      confirmedAt: row.confirmed_at,
      completedAt: row.completed_at,
      outcome: row.outcome,
      visitMode: visitModeOf(row.visit_mode),
      conversationId: row.conversation_id,
      slotMinutes: minutes,
    },
    lister: {
      name: nameOf(profile),
      photoUrl: photoOf(profile?.avatar_path ?? null),
      role: listerRoleWord(profile?.supply_role ?? null, (listingRow as { listing_role?: string | null } | null)?.listing_role ?? null),
      tier,
      handle: profile?.handle ?? null,
      phone: numbers.get(row.lister_id) ?? null,
    },
    reminders,
    videoOn,
  };
}

/**
 * How long the booked slot is, from the lister's viewing window. RLS answers
 * `viewing_windows` to its lister only, so the renter's own client always
 * read nothing here and the visit page never knew the slot's length. Called
 * only after the caller's own read proved they are the requester of the
 * inspection carrying this `window_id`; the service role reads one column of
 * that one window, nothing else. Any failure is null (no length shown).
 */
export async function readSlotMinutes(windowId: string | null): Promise<number | null> {
  if (!windowId) return null;
  try {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const { data, error } = await admin
      .from("viewing_windows")
      .select("slot_minutes")
      .eq("id", windowId)
      .maybeSingle();
    if (error) return null;
    const value = Number((data as { slot_minutes?: unknown } | null)?.slot_minutes);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * The renter's own reminders for the slot now on the row. Called only after
 * the caller's own read proved they are the requester; `viewing_reminders`
 * grants nothing to members, so this is the service role, narrowed to one
 * inspection, the renter audience and the current slot (a moved viewing's
 * old reminders are not this visit's). Any failure is "not sent", which draws
 * the step as still to come rather than claiming it happened.
 */
async function readRenterReminders(inspectionId: string, slotAt: string | null): Promise<VisitReminders> {
  if (!slotAt) return NO_REMINDERS;
  try {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const { data, error } = await admin
      .from("viewing_reminders")
      .select("stage, sent_at")
      .eq("inspection_id", inspectionId)
      .eq("audience", "renter")
      .eq("slot_at", slotAt);
    if (error || !Array.isArray(data)) return NO_REMINDERS;
    const sent = (stage: string) =>
      (data as { stage: string; sent_at: string }[]).find((one) => one.stage === stage)?.sent_at ?? null;
    return { eve: sent("eve"), day: sent("soon") };
  } catch {
    return NO_REMINDERS;
  }
}
