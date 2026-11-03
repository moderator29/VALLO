import { z } from "zod";
import { getListingRepository } from "@/lib/listings/repository";
import { createProposal } from "../proposals";
import type { AssistantStreamEvent } from "../types";
import { callerOf, NOT_SIGNED_IN, when } from "./private-common";
import { defineTool } from "./types";

const uuid = z.string().uuid();

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
type Slot = { slot_at: string; slot_minutes: number; window_id: string };

/** Real open viewing times for one listing, through the same function the listing page uses. Null when it could not be read. */
export async function readOpenSlots(supabase: unknown, listingId: string, days = 14): Promise<Slot[] | null> {
  try {
    const { data, error } = await (supabase as Rpc).rpc("viewing_slots", { p_listing: listingId, p_days: days });
    if (error || !Array.isArray(data)) return null;
    return (data as Slot[]).filter((s) => typeof s.slot_at === "string" && !Number.isNaN(Date.parse(s.slot_at)));
  } catch {
    return null;
  }
}

const EXAMPLE_VIEWING =
  "This is an example listing, so there is nothing to view. Say so, and offer to search for a real one.";

export const getViewingOptionsTool = defineTool({
  name: "get_viewing_options",
  description:
    "Look up the REAL open viewing times for ONE listing. They appear on screen as buttons the person taps; you are told how many there are and the first few. Never invent a time. If there are none, say so and point to the listing page to ask the lister for a time.",
  input: z.object({ listing_id: uuid }),
  inputSchema: {
    type: "object",
    properties: { listing_id: { type: "string", description: "The listing id exactly as search_listings gave it." } },
    required: ["listing_id"],
  },
  mode: "read",
  requires: "bookings_viewings",
  workspaces: ["consumer"],
  async run(ctx, input) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const l = await getListingRepository().byId(input.listing_id);
    if (!l) return { data: { error: "That listing could not be found." } };
    if (l.isDemo) return { data: { example: true, title: l.title }, note: EXAMPLE_VIEWING };
    const slots = await readOpenSlots(who.supabase, l.id);
    if (slots === null) return { data: { error: "Viewing times could not be read just now." } };
    if (slots.length === 0) {
      return {
        data: { title: l.title, openTimes: 0 },
        note: "There are no open viewing times. Say so, and tell the person they can ask the lister for a time from the listing page.",
      };
    }
    const shown = slots.slice(0, 12);
    const event: AssistantStreamEvent = {
      type: "slots",
      listingId: l.id,
      title: l.title,
      slots: shown.map((s) => ({ slotAt: s.slot_at, label: when(s.slot_at) })),
    };
    return {
      data: { title: l.title, openTimes: slots.length, firstTimes: shown.slice(0, 3).map((s) => when(s.slot_at)) },
      note: "The times are on screen as buttons. Tell the person to tap one. Nothing is booked until they confirm.",
      events: [event],
    };
  },
});

export const proposeViewingTool = defineTool({
  name: "propose_viewing",
  description:
    "Prepare a viewing for the person to CONFIRM, for one listing and one of the real open times. It books nothing: it puts a review card with a Confirm button on screen. Never say a viewing is booked or confirmed. Use get_viewing_options first.",
  input: z.object({ listing_id: uuid, slot_at: z.string().max(40) }),
  inputSchema: {
    type: "object",
    properties: {
      listing_id: { type: "string", description: "The listing id." },
      slot_at: { type: "string", description: "One of the times get_viewing_options returned, as an ISO date and time." },
    },
    required: ["listing_id", "slot_at"],
  },
  mode: "propose",
  requires: "bookings_viewings",
  workspaces: ["consumer"],
  async run(ctx, input) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const l = await getListingRepository().byId(input.listing_id);
    if (!l) return { data: { error: "That listing could not be found." } };
    if (l.isDemo) return { data: { example: true }, note: EXAMPLE_VIEWING };
    const slots = await readOpenSlots(who.supabase, l.id);
    const wanted = Date.parse(input.slot_at);
    const match = slots?.find((s) => Date.parse(s.slot_at) === wanted);
    if (!match) return { data: { error: "That time is not one of the open times. Ask for the options again." } };
    const made = await createProposal(who.supabase, "viewing_request", { listing_id: l.id, slot_at: match.slot_at, title: l.title });
    if (!made.ok) return { data: { error: "The viewing could not be prepared.", reason: made.reason } };
    return {
      data: { prepared: true, title: l.title, when: when(match.slot_at) },
      note: "A review card with a Confirm button is on screen. Say it is not booked until they confirm.",
      events: [
        { type: "summary", title: "Review your viewing", rows: [{ label: "Place", value: l.title }, { label: "When", value: when(match.slot_at) }], note: "Nothing is booked until you confirm." },
        {
          type: "actions",
          items: [
            { id: `confirm-${made.id}`, label: "Confirm viewing", kind: "confirm", proposalId: made.id, payloadHash: made.payloadHash },
            { id: `cancel-${made.id}`, label: "Cancel", kind: "cancel", proposalId: made.id, payloadHash: made.payloadHash },
          ],
        },
      ],
    };
  },
});

const STATE_WORDS: Record<string, string> = {
  REQUESTED: "Waiting for the lister",
  PROPOSED: "The lister proposed a time",
  CONFIRMED: "Confirmed",
  COMPLETED: "Done",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  NO_SHOW: "Missed",
};
export const viewingStateWord = (state: string): string => STATE_WORDS[state] ?? state.toLowerCase();

const LIVE_STATES = ["REQUESTED", "PROPOSED", "CONFIRMED"];

/** Open and still ahead: the only viewings the member can cancel or move. */
function isChangeable(r: Record<string, unknown>): boolean {
  const at = Date.parse(String(r.slot_at ?? r.requested_at ?? ""));
  return LIVE_STATES.includes(String(r.state)) && Number.isFinite(at) && at > Date.now();
}

export type OwnViewing = { id: string; listingId: string; state: string; at: string; title: string };

/**
 * One of the member's OWN viewings, read with their client (row level security)
 * and checked again by requester, so a stranger's id answers null. Never a
 * service-role read.
 */
export async function readOwnViewing(supabase: unknown, userId: string, id: string): Promise<OwnViewing | null> {
  try {
    const q = supabase as {
      from: (t: string) => {
        select: (c: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } };
      };
    };
    const { data, error } = await q
      .from("inspection_requests")
      .select("id, listing_id, requester_id, state, slot_at, requested_at")
      .eq("id", id)
      .eq("requester_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as Record<string, unknown>;
    if (String(r.requester_id) !== userId || !isChangeable(r)) return null;
    const titles = await titlesFor(supabase, [String(r.listing_id)]);
    return {
      id: String(r.id),
      listingId: String(r.listing_id),
      state: String(r.state),
      at: String(r.slot_at ?? r.requested_at),
      title: titles.get(String(r.listing_id)) ?? "Your viewing",
    };
  } catch {
    return null;
  }
}

/** Open times to move one of the member's own viewings to (the listing's real windows, minus the current time). */
export async function moveOptionsFor(supabase: unknown, viewing: OwnViewing): Promise<Slot[] | null> {
  const slots = await readOpenSlots(supabase, viewing.listingId);
  if (slots === null) return null;
  const current = Date.parse(viewing.at);
  return slots.filter((s) => Date.parse(s.slot_at) !== current);
}

const NOT_YOURS = { data: { error: "That viewing is not one of the person's open, upcoming viewings. Use list_my_viewings for the ids." } } as const;

export const proposeCancelViewingTool = defineTool({
  name: "propose_cancel_viewing",
  description:
    "Prepare the cancellation of ONE of the person's own upcoming viewings (an id from list_my_viewings) for them to CONFIRM. It cancels nothing by itself: a review card with a Confirm button appears. Never say it is cancelled until they confirm.",
  input: z.object({ inspection_id: uuid }),
  inputSchema: {
    type: "object",
    properties: { inspection_id: { type: "string", description: "The viewing id from list_my_viewings." } },
    required: ["inspection_id"],
  },
  mode: "propose",
  requires: "bookings_viewings",
  workspaces: ["consumer"],
  async run(ctx, input) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const v = await readOwnViewing(who.supabase, who.userId, input.inspection_id);
    if (!v) return NOT_YOURS;
    const made = await createProposal(who.supabase, "cancel_viewing", { inspection_id: v.id, title: v.title, at: v.at });
    if (!made.ok) return { data: { error: "The cancellation could not be prepared.", reason: made.reason } };
    return {
      data: { prepared: true, place: v.title, when: when(v.at) },
      note: "A review card with a Confirm button is on screen. Say the viewing stands until they confirm.",
      events: cancelReview(v, made.id, made.payloadHash),
    };
  },
});

export const getMoveOptionsTool = defineTool({
  name: "get_move_options",
  description:
    "Look up the REAL open times one of the person's own upcoming viewings (an id from list_my_viewings) could be moved to. They appear as buttons. Never invent a time.",
  input: z.object({ inspection_id: uuid }),
  inputSchema: {
    type: "object",
    properties: { inspection_id: { type: "string", description: "The viewing id from list_my_viewings." } },
    required: ["inspection_id"],
  },
  mode: "read",
  requires: "bookings_viewings",
  workspaces: ["consumer"],
  async run(ctx, input) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const v = await readOwnViewing(who.supabase, who.userId, input.inspection_id);
    if (!v) return NOT_YOURS;
    const slots = await moveOptionsFor(who.supabase, v);
    if (slots === null) return { data: { error: "Open times could not be read just now." } };
    if (slots.length === 0) {
      return { data: { place: v.title, openTimes: 0 }, note: "There are no other open times. Say so, and suggest asking the lister in the chat." };
    }
    const shown = slots.slice(0, 12);
    return {
      data: { place: v.title, openTimes: slots.length },
      note: "The times are on screen as buttons. Tell the person to tap one. Nothing moves until they confirm.",
      events: [{ type: "slots", listingId: v.listingId, title: v.title, moveFrom: v.id, slots: shown.map((s) => ({ slotAt: s.slot_at, label: when(s.slot_at) })) }],
    };
  },
});

export const proposeRescheduleViewingTool = defineTool({
  name: "propose_reschedule_viewing",
  description:
    "Prepare moving ONE of the person's own upcoming viewings to one of the real open times from get_move_options, for them to CONFIRM. It moves nothing by itself. Never say it is moved until they confirm.",
  input: z.object({ inspection_id: uuid, slot_at: z.string().max(40) }),
  inputSchema: {
    type: "object",
    properties: {
      inspection_id: { type: "string", description: "The viewing id from list_my_viewings." },
      slot_at: { type: "string", description: "One of the times get_move_options returned." },
    },
    required: ["inspection_id", "slot_at"],
  },
  mode: "propose",
  requires: "bookings_viewings",
  workspaces: ["consumer"],
  async run(ctx, input) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const v = await readOwnViewing(who.supabase, who.userId, input.inspection_id);
    if (!v) return NOT_YOURS;
    const slots = await moveOptionsFor(who.supabase, v);
    const wanted = Date.parse(input.slot_at);
    const match = slots?.find((s) => Date.parse(s.slot_at) === wanted);
    if (!match) return { data: { error: "That time is not one of the open times. Ask for the options again." } };
    const made = await createProposal(who.supabase, "reschedule_viewing", { inspection_id: v.id, slot_at: match.slot_at, title: v.title, from: v.at });
    if (!made.ok) return { data: { error: "The move could not be prepared.", reason: made.reason } };
    return {
      data: { prepared: true, place: v.title, from: when(v.at), to: when(match.slot_at) },
      note: "A review card with a Confirm button is on screen. Say the current time stands until they confirm.",
      events: moveReview(v, match.slot_at, made.id, made.payloadHash),
    };
  },
});

/** The review card for cancelling one of the member's own viewings. */
export function cancelReview(v: OwnViewing, proposalId: string, payloadHash: string): AssistantStreamEvent[] {
  return [
    { type: "summary", title: "Cancel this viewing?", rows: [{ label: "Place", value: v.title }, { label: "When", value: when(v.at) }], note: "The lister is told. Nothing changes until you confirm." },
    {
      type: "actions",
      items: [
        { id: `confirm-${proposalId}`, label: "Confirm cancellation", kind: "confirm", proposalId, payloadHash },
        { id: `cancel-${proposalId}`, label: "Keep my viewing", kind: "cancel", proposalId, payloadHash },
      ],
    },
  ];
}

/** The review card for moving one of the member's own viewings. */
export function moveReview(v: OwnViewing, slotAt: string, proposalId: string, payloadHash: string): AssistantStreamEvent[] {
  return [
    {
      type: "summary",
      title: "Move this viewing?",
      rows: [{ label: "Place", value: v.title }, { label: "From", value: when(v.at) }, { label: "To", value: when(slotAt) }],
      note: "The lister is told. Your current time stands until you confirm.",
    },
    {
      type: "actions",
      items: [
        { id: `confirm-${proposalId}`, label: "Confirm new time", kind: "confirm", proposalId, payloadHash },
        { id: `cancel-${proposalId}`, label: "Keep my time", kind: "cancel", proposalId, payloadHash },
      ],
    },
  ];
}

type Row = Record<string, unknown>;
type Table = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }> } };
      in: (c: string, v: string[]) => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
};

async function titlesFor(supabase: unknown, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return map;
  try {
    const { data } = await (supabase as Table).from("listings").select("id, title").in("id", uniq);
    for (const r of (Array.isArray(data) ? data : []) as Row[]) map.set(String(r.id), String(r.title ?? "A place"));
  } catch {
    /* A title that cannot be read is drawn as "A place". */
  }
  return map;
}

export const listMyViewingsTool = defineTool({
  name: "list_my_viewings",
  description: "List the person's own viewing requests and booked viewings, newest first, with their state. Read only.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  requires: "bookings_viewings",
  workspaces: ["consumer"],
  async run(ctx) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    try {
      const { data, error } = await (who.supabase as Table)
        .from("inspection_requests")
        .select("id, listing_id, state, slot_at, requested_at")
        .eq("requester_id", who.userId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error || !Array.isArray(data)) return { data: { error: "Your viewings could not be read just now." } };
      const rows = data as Row[];
      const titles = await titlesFor(who.supabase, rows.map((r) => String(r.listing_id)));
      const items = rows.map((r) => ({
        id: String(r.id),
        place: titles.get(String(r.listing_id)) ?? "A place",
        when: when(String(r.slot_at ?? r.requested_at ?? "")),
        state: viewingStateWord(String(r.state)),
        changeable: isChangeable(r),
      }));
      if (items.length === 0) return { data: { viewings: [] }, note: "The person has no viewings yet. Say so." };
      /* Each open viewing that is still ahead gets its own Cancel and Move buttons. */
      const buttons = items
        .filter((i) => i.changeable)
        .slice(0, 3)
        .flatMap((i) => [
          { id: `move-${i.id}`, label: `Move: ${i.place}`, kind: "viewing_move" as const, inspectionId: i.id },
          { id: `drop-${i.id}`, label: `Cancel: ${i.place}`, kind: "viewing_cancel" as const, inspectionId: i.id },
        ]);
      const events: AssistantStreamEvent[] = [
        { type: "summary", title: "Your viewings", rows: items.map((i) => ({ label: i.place, value: i.when, status: i.state })) },
      ];
      if (buttons.length > 0) events.push({ type: "actions", items: buttons });
      return {
        data: { viewings: items.map(({ changeable, ...rest }) => ({ ...rest, canCancelOrMove: changeable })) },
        events,
      };
    } catch {
      return { data: { error: "Your viewings could not be read just now." } };
    }
  },
});

export const listMyBookingsTool = defineTool({
  name: "list_my_bookings",
  description: "List the person's own stay bookings, newest first, with dates, total and state. Read only.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  requires: "bookings_viewings",
  workspaces: ["consumer"],
  async run(ctx) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    try {
      const { data, error } = await (who.supabase as Table)
        .from("bookings")
        .select("id, listing_id, check_in, check_out, total_minor, currency, status")
        .eq("guest_id", who.userId)
        .order("check_in", { ascending: false })
        .limit(8);
      if (error || !Array.isArray(data)) return { data: { error: "Your bookings could not be read just now." } };
      const rows = data as Row[];
      const titles = await titlesFor(who.supabase, rows.map((r) => String(r.listing_id ?? "")));
      const { formatMoney } = await import("@vallo/i18n/core");
      const items = rows.map((r) => ({
        place: titles.get(String(r.listing_id)) ?? "A stay",
        dates: `${String(r.check_in)} to ${String(r.check_out)}`,
        total: formatMoney(Number(r.total_minor ?? 0)),
        status: String(r.status ?? "").toLowerCase(),
      }));
      if (items.length === 0) return { data: { bookings: [] }, note: "The person has no bookings yet. Say so." };
      return {
        data: { bookings: items },
        events: [{ type: "summary", title: "Your bookings", rows: items.map((i) => ({ label: i.place, value: `${i.dates}, ${i.total}`, status: i.status })) }],
      };
    } catch {
      return { data: { error: "Your bookings could not be read just now." } };
    }
  },
});
