import "server-only";

/**
 * Live messaging reads for the server shells.
 *
 * Everything here reads through the signed-in user's RLS-bound client, so the
 * database decides what they may see. The one exception is identity: profiles
 * and agents are select-own tables by design, so the counterpart's display
 * name (and an agent's verified state) is resolved through the service role
 * strictly after RLS has already handed us the conversation. Without the
 * service key the loops still work; people just render under a generic label
 * until it lands.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { resolveSession } from "../actions/session";
import type { Database } from "../supabase/database.types";
import { createAdminClient } from "../supabase/admin";
import { callableNumberFor } from "../security/counterpart-contact";
import type { ThreadContextKind } from "./db";
import type { Side } from "../side.constants";
import { threadSide } from "./thread-side";
import { lagosTimeLabel, lagosWhenLabel } from "./time";
import { readPersonBadges, type BadgeTier } from "@/lib/trust/badge-tier";
import { readViewerFollowing } from "../social/follows-queries";
import { loadUnreadCounts } from "./unread";
import { isRequestThread } from "./request-rule";
import { reactionMapFrom, type ReactionMap } from "./reactions";
import { cleanDuration, cleanPeaks } from "./voice-note";

type Db = SupabaseClient<Database>;

/* The columns the inbox selects. `severity` exists on the table but is not read here. */
export type NotificationRow = Omit<Database["public"]["Tables"]["notifications"]["Row"], "severity">;

export type LiveConversationSummary = {
  id: string;
  counterpartName: string;
  listingTitle: string | null;
  lastMessage: string;
  /** Preformatted Lagos label: time today, date otherwise. */
  whenLabel: string;
  unread: number;
  /**
   * True when the caller sent the most recent message. The host inbox uses it
   * to answer "who is still waiting on me", which a raw unread count cannot:
   * an agent can have read an enquiry and still not have replied to it.
   */
  lastFromMe: boolean;
  /** ISO instant of the most recent message, for ageing a waiting thread. */
  lastAt: string;
  /** The newest message's id: VC1 asks whether it is a call marker (the inbox's missed-call line). */
  lastMessageId?: string | null;
  /**
   * True when this thread is a request: the caller does not follow the person
   * on the other side, did not open it, and has never sent a message in it
   * (`request-rule.ts`). The inbox holds these in their own tab so a stranger
   * cannot land in the main list.
   */
  isRequest: boolean;
  /**
   * The caller follows the person on the other side (`public.follows`).
   * Always set by `loadConversationSummaries`; optional only so fixtures
   * written before it still type.
   */
  viewerFollows?: boolean;
  /** The counterpart's photo (`profiles.avatar_url`, a public URL), or null. */
  counterpartAvatarUrl?: string | null;
  /**
   * What the counterpart is, for the small dot on the avatar. "agent" is a
   * host, verified or not; "member" is everybody else.
   */
  counterpartKind: "agent" | "member";
  /** True when the counterpart is a verified agent. */
  counterpartVerified: boolean;
  /** The counterpart's published badge, `public.person_badge.tier`. */
  counterpartTier: BadgeTier;
  /**
   * What the thread is about, for the small context glyph on the row. A
   * rental enquiry, a restaurant table, or a stay. Every thread before M10 is
   * a listing thread.
   */
  contextKind: ThreadContextKind;
  /** Property or Stays, for the inbox's two top tabs (track G). See `thread-side.ts`. Absent reads as property. */
  side?: Side;
  /** The other party's user id, for matching a report on the person (track G). */
  counterpartId?: string;
};

export type LiveThreadMessage = {
  id: string;
  mine: boolean;
  body: string;
  /** Preformatted Lagos "HH:MM". */
  timeLabel: string;
  imageUrl: string | null;
  /** The photo's own pixel size, as `attachImage` recorded it, so it is drawn at its proportions. */
  imageSize?: { width: number; height: number } | null;
  /** The row's own timestamp. V-04's account card reads it for its one-minute "checking" window. */
  createdAt?: string;
  /** The message this one answers (`messages.reply_to_id`). */
  replyToId?: string | null;
  /** Forwarded from another conversation. */
  forwarded?: boolean;
  /** Deleted for everyone: the words and the attachment are gone for both sides. */
  deleted?: boolean;
  /**
   * GRADE 1 (P1.3): a voice note, when the attachment is `kind = 'audio'`: a
   * signed URL, its stored length and its stored bars. Null otherwise, and
   * always null on a database without the voice-note migration.
   */
  audio?: { url: string; durationMs: number | null; peaks: number[] | null } | null;
};

/** One attachment as the thread draws it, whichever columns the database has. */
type ThreadAttachment = {
  storage_path: string;
  width: number | null;
  height: number | null;
  kind: string;
  duration_ms: number | null;
  peaks: unknown;
};

type ThreadMessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  reply_to_id: string | null;
  forwarded: boolean;
  deleted_for_everyone_at: string | null;
  message_attachments: ThreadAttachment[];
};

/**
 * The thread's messages with their attachments. The voice-note columns
 * (`kind`, `duration_ms`, `peaks`) are asked for first; a database the
 * pending migration has not reached refuses that select, and the read falls
 * back to the columns every database has, every attachment then a photo, as
 * it always was. Either way the thread opens.
 */
async function readThreadMessages(supabase: Db, conversationId: string): Promise<ThreadMessageRow[]> {
  const voiced = await supabase
    .from("messages")
    .select(
      "id, sender_id, body, created_at, reply_to_id, forwarded, deleted_for_everyone_at, message_attachments(storage_path, width, height, kind, duration_ms, peaks)",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (!voiced.error) return (voiced.data ?? []) as ThreadMessageRow[];
  const plain = await supabase
    .from("messages")
    .select(
      "id, sender_id, body, created_at, reply_to_id, forwarded, deleted_for_everyone_at, message_attachments(storage_path, width, height)",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (plain.data ?? []).map((m) => ({
    ...m,
    message_attachments: m.message_attachments.map((a) => ({ ...a, kind: "image", duration_ms: null, peaks: null })),
  }));
}

/**
 * Every reaction in one thread, by message, under the reader's own RLS (members
 * only, by the table's policy). NULL when the read fails, which is what a
 * database without the `message_reactions` table answers: the thread then
 * draws no reactions and offers none, rather than offering a control that
 * cannot work.
 */
export async function loadThreadReactions(supabase: Db, conversationId: string): Promise<ReactionMap | null> {
  try {
    const { data, error } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .eq("conversation_id", conversationId)
      .limit(2000);
    if (error) return null;
    return reactionMapFrom(data ?? []);
  } catch {
    return null;
  }
}

export type LiveThreadData = {
  conversationId: string;
  meId: string;
  counterpartName: string;
  /**
   * The other party's number, in the canonical `+234...` form, for the call
   * control the thread header draws beside the kebab.
   *
   * NULL IS A REAL ANSWER AND IT IS THE COMMON ONE. Nobody is obliged to put a
   * number on their account, a block withholds it, and a platform with no
   * service key resolves nothing at all. The header draws the control only
   * when this is a string, so a dead dialler is structurally impossible.
   *
   * `lib/security/counterpart-contact.ts` is where the entitlement is decided
   * and is the only place it may be changed. This read's own job is the half
   * above it: the membership check three lines up is what makes the caller a
   * party at all, and nothing is resolved before it has passed.
   */
  counterpartPhone: string | null;
  /** The other party's public handle, or null when they have not claimed one. */
  counterpartHandle: string | null;
  /** The other party's photo, or null: their initial is drawn instead. */
  counterpartAvatarUrl: string | null;
  /** The reader's own name and photo, for the head of their own bubbles. */
  meName: string | null;
  meAvatarUrl: string | null;
  /**
   * The other party's user id.
   *
   * It was always computed in this file and then thrown away, so the thread
   * could name the counterpart and never act on them. The block control needs
   * an id and nothing else in the thread could produce one, which is the
   * structural reason a person could be harassed inside a conversation with
   * no control to press. It is the counterpart's id under the caller's own
   * RLS membership check, so it discloses nothing a party to the thread could
   * not already read.
   */
  counterpartId: string;
  /** The counterpart's published badge, `public.person_badge.tier`. */
  counterpartTier: BadgeTier;
  listing: {
    id: string;
    title: string;
    area: string;
    city: string;
    verified: boolean;
    hue: number;
  } | null;
  inspected: boolean;
  messages: LiveThreadMessage[];
};

const FALLBACK_NAME = "Vallo member";

/** Deterministic 0..5 hue index from an id, for the placeholder tile. */
function hueOf(id: string): number {
  let acc = 0;
  for (let i = 0; i < id.length; i += 1) acc = (acc + id.charCodeAt(i)) % 6;
  return acc;
}

type Identity = { name: string; verified: boolean; isAgent: boolean; tier: BadgeTier; avatarUrl: string | null };

/**
 * Resolve display identities for counterpart user ids through the service
 * role. An agent's brand name wins over their personal profile name. Fails
 * soft to an empty map when the service key is absent.
 */
async function identitiesOf(userIds: string[]): Promise<Map<string, Identity>> {
  const map = new Map<string, Identity>();
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return map;
  try {
    const admin = createAdminClient();
    const [profiles, agents] = await Promise.all([
      /* The photo rides the same read: `avatar_url` is the public URL the
         profile editor writes, drawn in the inbox row, the thread header and
         the head of the person's bubbles (their initial when it is empty). */
      admin.from("profiles").select("id, display_name, avatar_url").in("id", ids),
      /*
       * THE TICK COMES OFF THE LADDER, NOT OFF `agents.verified`.
       *
       * This read used to take the raw `agents.verified` boolean, which the
       * agent application approval set to true at `verification_tier` 0,
       * before a single document had been looked at. The result was a tick on
       * the avatar in every message thread and no tick on any listing behind
       * it, because the listing surfaces read `agent_badges`, which
       * `private.sync_agent_badge` derives from the KYC ladder as
       * `verification_tier >= 1`. Two derivations of one badge, disagreeing on
       * the surface where somebody decides whether to send a deposit.
       *
       * `agent_badges` is the published one and it is the only one now. It
       * means exactly one thing: a person here looked at a government document
       * and said yes.
       *
       * A MISSING ROW READS AS NOT VERIFIED, for the reason `getAgentBadges()`
       * gives in the listings repository: the failure mode of this must be a
       * tick that does not appear, never a tick that appears with no check
       * behind it.
       */
      admin
        .from("agents")
        .select("user_id, display_name, agent_badges(verified)")
        .in("user_id", ids),
    ]);
    /*
     * THE TIER, FROM THE ONE PUBLISHED DOOR, AND IT IS KEYED BY THE PERSON.
     *
     * `agent_badges` is keyed by AGENT, so it can only ever answer for an
     * agent. A member of staff is not an agent and would have drawn nothing in
     * a thread, which is the founder's own account in his own messages.
     * `public.person_badge` answers for anybody, and it is the same derivation:
     * `public.badge_tier` over `public.is_platform_staff` and
     * `public.is_checked_person`. Migration 20260923111950; since
     * 20260929000714 the view reaches both through the definer
     * `private.badge_tier_for`, and neither helper is callable by a client.
     */
    const badges = await readPersonBadges(admin, ids);
    const photos = new Map<string, string>();
    for (const p of profiles.data ?? []) {
      if (p.avatar_url) photos.set(p.id, p.avatar_url);
    }

    for (const p of profiles.data ?? []) {
      if (p.display_name) {
        map.set(p.id, {
          name: p.display_name,
          verified: false,
          isAgent: false,
          tier: badges.get(p.id) ?? "none",
          avatarUrl: photos.get(p.id) ?? null,
        });
      }
    }
    for (const a of agents.data ?? []) {
      map.set(a.user_id, {
        name: a.display_name,
        verified: a.agent_badges?.verified ?? false,
        isAgent: true,
        tier: badges.get(a.user_id) ?? "none",
        avatarUrl: photos.get(a.user_id) ?? null,
      });
    }
  } catch {
    // No service key yet: generic labels carry the surface.
  }
  return map;
}

/**
 * The signed-in user's conversations, newest activity first, with counterpart
 * name, listing title, last message preview and unread count. The
 * conversations themselves, then one recent-messages sweep for the previews
 * and `my_unread_counts()` for exact unread counts, without an N+1.
 */
export async function loadConversationSummaries(
  supabase: Db,
  user: User,
): Promise<LiveConversationSummary[]> {
  /* A reservation or booking thread carries no listing_id of its own (the
     M10 shape check), so its title is reached through the transaction. One
     select, three embeds, and PostgREST leaves the two that do not apply
     null. */
  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      "id, guest_id, agent_id, last_message_at, context_kind, listings(title, property_type, listing_intent, rent_period, rate_period, rent_amount_minor, rate_minor), reservations!conversations_reservation_id_fkey(listings(title)), bookings!conversations_booking_id_fkey(listings(title)), businesses!conversations_business_id_fkey(name)",
    )
    /* SEC-02. RLS lets an admin read every conversation; the inbox is the
       caller's own threads, so the caller is named as a party. */
    .or(`guest_id.eq.${user.id},agent_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false })
    .limit(50);
  if (!conversations || conversations.length === 0) return [];

  const ids = conversations.map((c) => c.id);
  const counterparts = conversations.map((c) => (c.guest_id === user.id ? c.agent_id : c.guest_id));

  /* The three reads below need only the conversations, so they go out
     together rather than one after another (Track M performance: the inbox
     finished 1.4 seconds after the tap on production). What each one reads
     is unchanged. */
  const [{ data: recent }, { data: mine }, identities, exactUnread, { data: myProfile }, followed, { data: myHidden }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at, read_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(400),
    /* Which threads the caller has ever spoken in. The recent sweep is
       bounded at 400 messages across every conversation, so it cannot answer
       this on its own: a thread the caller replied to a year and two hundred
       messages ago would come back as a request. One narrow query, keyed on
       the caller's own id, answers it exactly. */
    supabase.from("messages").select("conversation_id").in("conversation_id", ids).eq("sender_id", user.id).limit(1000),
    identitiesOf(counterparts),
    /* DB2: unread counts are exact, from my_unread_counts() and its partial
       index. The recent sweep above still gives the previews; it counted
       unread too, and missed anything below its 400th message. It stays
       only as the fallback when the function cannot be read. */
    loadUnreadCounts(supabase),
    /* How this person wants to be written to (profile setting "Who can message
       you"): "Anyone" lets a new person's chat arrive in Primary instead of
       Requests. Read once for the whole inbox. */
    supabase.from("social_profiles").select("contact_policy").eq("user_id", user.id).maybeSingle(),
    /* Who the caller follows among the people on the other side, from
       `public.follows` through the follow list's own helper. A message from
       somebody the caller does not follow waits in Requests (founder, 11
       October 2026), and the forward chooser offers only these people. A
       failed read answers "follows nobody", so nothing leaves Requests by
       accident. */
    readViewerFollowing(supabase, user.id, [...new Set(counterparts)]),
    /* Delete for me: a message the caller hid is not the chat's preview
       either, exactly as `loadThread` leaves it out of the thread. Their own
       rows only (RLS). */
    supabase.from("message_hidden").select("message_id").eq("user_id", user.id).limit(1000),
  ]);
  const hiddenIds = new Set((myHidden ?? []).map((h) => h.message_id));
  const withAnyMessage = new Set((recent ?? []).map((m) => m.conversation_id));
  const openToAnyone = (myProfile as { contact_policy?: string } | null)?.contact_policy === "OPEN";

  const lastByConversation = new Map<
    string,
    { id: string; body: string; at: string; senderId: string }
  >();
  const unreadByConversation = new Map<string, number>();
  for (const m of recent ?? []) {
    if (!lastByConversation.has(m.conversation_id) && !hiddenIds.has(m.id)) {
      lastByConversation.set(m.conversation_id, {
        id: m.id,
        body: m.body,
        at: m.created_at,
        senderId: m.sender_id,
      });
    }
    if (!exactUnread && m.sender_id !== user.id && m.read_at === null) {
      unreadByConversation.set(
        m.conversation_id,
        (unreadByConversation.get(m.conversation_id) ?? 0) + 1,
      );
    }
  }

  const spokenIn = new Set<string>();
  for (const row of mine ?? []) spokenIn.add(row.conversation_id);

  /* UX-P2-03: a listing (or direct) thread with no message in it is a tap
     somebody abandoned (the old "Message" page opened one on load). It is not
     shown in either inbox. Only when the recent sweep was not cut off, so an old,
     quiet thread is never mistaken for an empty one. */
  const sweepComplete = (recent ?? []).length < 400;
  const shown = conversations.filter(
    (c) =>
      !(
        sweepComplete &&
        /* Any message at all, hidden ones included: a chat whose messages the
           caller hid is still a chat, not an abandoned tap. */
        !withAnyMessage.has(c.id) &&
        ((c.context_kind ?? "listing") === "listing" || c.context_kind === "direct")
      ),
  );

  return shown.map((c) => {
    const counterpartId = c.guest_id === user.id ? c.agent_id : c.guest_id;
    const last = lastByConversation.get(c.id);
    const identity = identities.get(counterpartId);
    const viewerFollows = followed.has(counterpartId);
    return {
      id: c.id,
      counterpartName: identity?.name ?? FALLBACK_NAME,
      listingTitle:
        c.listings?.title ??
        c.reservations?.listings?.title ??
        c.bookings?.listings?.title ??
        /* Track F: a thread about a hotel or a restaurant names the venue. */
        c.businesses?.name ??
        null,
      lastMessage: last?.body ?? "No messages yet",
      lastMessageId: last?.id ?? null,
      whenLabel: lagosWhenLabel(last?.at ?? c.last_message_at),
      unread: (exactUnread ? exactUnread.byConversation : unreadByConversation).get(c.id) ?? 0,
      /* No messages at all counts as not from us, so a brand new enquiry with
         nothing in it still reads as waiting rather than as answered. */
      lastFromMe: last ? last.senderId === user.id : false,
      lastAt: last?.at ?? c.last_message_at,
      /* A request is a thread from somebody the caller does not follow, that
         the caller has never spoken in AND did not open. An enquiry the
         caller sent themselves is theirs even before the host answers, so it
         belongs in Primary from the first second. The rule is `request-rule.ts`. */
      isRequest: isRequestThread({
        spokenIn: spokenIn.has(c.id),
        openedByReader: c.guest_id === user.id,
        readerFollows: viewerFollows,
        direct: c.context_kind === "direct",
        openToAnyone,
      }),
      viewerFollows,
      counterpartAvatarUrl: identity?.avatarUrl ?? null,
      counterpartKind: identity?.isAgent ? "agent" : "member",
      counterpartVerified: identity?.verified ?? false,
      counterpartTier: identity?.tier ?? "none",
      contextKind: c.context_kind,
      side: threadSide(c.context_kind, c.listings),
      counterpartId,
    };
  });
}

/* ------------------------------------------------------------ thread context */

type BookingStatus = Database["public"]["Enums"]["booking_status"];

/**
 * What a thread is about, for the banner above the messages.
 *
 * One shape with optional halves rather than a discriminated union, because
 * the banner renders whichever half is present and the thread page should
 * not have to narrow before it can read `kind`. Exactly one of `listing`,
 * `reservation` or `booking` is set for a thread that has a context at all; a
 * general listing thread with no listing sets none of them.
 */
export type ThreadContext = {
  kind: ThreadContextKind;
  listing?: {
    id: string;
    title: string;
    area: string;
    city: string;
    /** Who listed it: `owner` is the landlord, `agent` or `firm` an agent. */
    listingRole: "owner" | "agent" | "firm" | null;
  };
  reservation?: {
    id: string;
    state: BookingStatus;
    /** ISO instant. */
    reservedFor: string;
    partySize: number;
    note: string | null;
    /** Null for a reservation held against a business rather than a listing (M7). */
    listingId: string | null;
    listingTitle: string | null;
  };
  booking?: {
    id: string;
    status: BookingStatus;
    /** ISO date. */
    checkIn: string;
    /** ISO date. */
    checkOut: string;
    title: string;
    nights: number;
    /** Integer kobo. */
    totalMinor: number;
    listingId: string;
  };
  /**
   * The booking's step events, oldest first, from booking_state_events. A
   * step is not a message (research section 3.4): the thread page interleaves
   * these with the human messages by timestamp at render time.
   */
  stateEvents?: Array<{ at: string; from: BookingStatus | null; to: BookingStatus }>;
};

/**
 * The context of one thread the caller is a party to, or null when the
 * thread is not theirs, does not exist, or cannot be read.
 *
 * Membership is RLS's answer and is re-checked explicitly, as loadThread
 * does, because an admin can read conversations they are not in. The
 * transaction halves are read through the caller's own client too:
 * reservations and bookings both carry guest and host select policies, so a
 * party to the thread is a party to the transaction by construction (the M10
 * trigger made it so on insert).
 */
export async function getThreadContext(conversationId: string): Promise<ThreadContext | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const { data: conversation } = await session.supabase
    .from("conversations")
    .select(
      "id, guest_id, agent_id, context_kind, listing_id, reservation_id, booking_id, listings(id, title, area, city, listing_role)",
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return null;
  const me = session.user.id;
  if (conversation.guest_id !== me && conversation.agent_id !== me) return null;

  if (conversation.context_kind === "reservation" && conversation.reservation_id) {
    const { data: reservation } = await session.supabase
      .from("reservations")
      .select("id, status, reserved_for, party_size, note, listing_id, listings(title)")
      .eq("id", conversation.reservation_id)
      .maybeSingle();
    if (!reservation) return { kind: "reservation" };
    return {
      kind: "reservation",
      reservation: {
        id: reservation.id,
        state: reservation.status,
        reservedFor: reservation.reserved_for,
        partySize: reservation.party_size,
        note: reservation.note,
        listingId: reservation.listing_id,
        listingTitle: reservation.listings?.title ?? null,
      },
    };
  }

  if (conversation.context_kind === "booking" && conversation.booking_id) {
    const [{ data: booking }, { data: events }] = await Promise.all([
      session.supabase
        .from("bookings")
        .select("id, status, check_in, check_out, nights, total_minor, listing_id, listings(title)")
        .eq("id", conversation.booking_id)
        .maybeSingle(),
      session.supabase
        .from("booking_state_events")
        .select("created_at, from_status, to_status")
        .eq("booking_id", conversation.booking_id)
        .order("created_at", { ascending: true })
        .limit(50),
    ]);
    if (!booking) return { kind: "booking" };
    return {
      kind: "booking",
      booking: {
        id: booking.id,
        status: booking.status,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        title: booking.listings?.title ?? "Your stay",
        nights: booking.nights,
        totalMinor: booking.total_minor,
        /* Empty for a hotel room, which has no listing (ROOM BOOKINGS 1). */
        listingId: booking.listing_id ?? "",
      },
      stateEvents: (events ?? []).map((event) => ({
        at: event.created_at,
        from: event.from_status,
        to: event.to_status,
      })),
    };
  }

  /* A chat between two members (9 October 2026): no listing, no desk, no
     agent and tenant tags, just the two people. */
  if (conversation.context_kind === "direct") return { kind: "direct" };

  return {
    kind: "listing",
    ...(conversation.listings
      ? {
          listing: {
            id: conversation.listings.id,
            title: conversation.listings.title,
            area: conversation.listings.area ?? "",
            city: conversation.listings.city ?? "",
            listingRole: conversation.listings.listing_role ?? null,
          },
        }
      : {}),
  };
}

/**
 * One conversation in full: membership-checked by RLS, messages in order,
 * attachments resolved to short-lived signed URLs, and the caller's own
 * inspection state for the options sheet.
 */
export async function loadThread(
  supabase: Db,
  user: User,
  conversationId: string,
): Promise<LiveThreadData | null> {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, guest_id, agent_id, listing_id, listings(id, title, area, city)")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return null;
  if (conversation.guest_id !== user.id && conversation.agent_id !== user.id) return null;

  const [messagesRaw, { data: myInspection }, { data: myHidden }] = await Promise.all([
    readThreadMessages(supabase, conversationId),
    supabase
      .from("inspection_confirmations")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    /* Delete for me: the messages this reader hid. Their own rows only (RLS). */
    supabase.from("message_hidden").select("message_id").eq("user_id", user.id),
  ]);
  const hiddenIds = new Set((myHidden ?? []).map((h) => h.message_id));
  const messages = (messagesRaw ?? []).filter((m) => !hiddenIds.has(m.id));

  // Signed URLs for every attachment in one round trip; the storage policy
  // has already limited reads to conversation members.
  const paths = (messages ?? []).flatMap((m) =>
    m.message_attachments.map((a) => a.storage_path),
  );
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("message-attachments")
      .createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl && !s.error) urlByPath.set(s.path, s.signedUrl);
    }
  }

  const counterpartId =
    conversation.guest_id === user.id ? conversation.agent_id : conversation.guest_id;
  /* Both halves of the counterpart's identity resolve together, and both only
     after the membership check above has passed. The name fails soft to a
     generic label; the number fails soft to nothing at all, because a label
     that is too generic is a small loss and a number handed to the wrong
     reader is not. */
  const [identities, counterpartPhone, handleRow] = await Promise.all([
    /* The reader's own identity rides the same read, for the photo or the
       initial at the head of their own bubbles. */
    identitiesOf([counterpartId, user.id]),
    callableNumberFor(user.id, counterpartId),
    /* The public handle, so the person's avatar in the thread can open their profile. */
    createAdminClient()
      .from("social_profiles")
      .select("handle")
      .eq("user_id", counterpartId)
      .maybeSingle()
      .then((r) => r.data),
  ]);
  const counterpart = identities.get(counterpartId);
  const me = identities.get(user.id);

  return {
    conversationId: conversation.id,
    meId: user.id,
    counterpartName: counterpart?.name ?? FALLBACK_NAME,
    counterpartAvatarUrl: counterpart?.avatarUrl ?? null,
    meName: me?.name ?? null,
    meAvatarUrl: me?.avatarUrl ?? null,
    /* The person's published badge. `listing.verified` two lines below is a
       different fact about a PROPERTY and the two are never interchangeable. */
    counterpartTier: counterpart?.tier ?? "none",
    counterpartPhone,
    counterpartId,
    counterpartHandle: handleRow?.handle ?? null,
    listing: conversation.listings
      ? {
          id: conversation.listings.id,
          title: conversation.listings.title,
          area: conversation.listings.area ?? "",
          city: conversation.listings.city ?? "",
          verified: counterpart?.verified ?? false,
          hue: hueOf(conversation.listings.id),
        }
      : null,
    inspected: Boolean(myInspection),
    messages: (messages ?? []).map((m) => {
      const attachment = m.message_attachments[0];
      const path = attachment?.storage_path;
      const deleted = m.deleted_for_everyone_at !== null;
      const voice = attachment?.kind === "audio";
      const url = !deleted && path ? (urlByPath.get(path) ?? null) : null;
      return {
        id: m.id,
        mine: m.sender_id === user.id,
        body: m.body,
        timeLabel: lagosTimeLabel(m.created_at),
        imageUrl: voice ? null : url,
        imageSize:
          !voice && attachment?.width && attachment?.height ? { width: attachment.width, height: attachment.height } : null,
        audio:
          voice && url
            ? { url, durationMs: cleanDuration(attachment.duration_ms), peaks: cleanPeaks(attachment.peaks) }
            : null,
        createdAt: m.created_at,
        replyToId: m.reply_to_id ?? null,
        forwarded: m.forwarded === true,
        deleted,
      };
    }),
  };
}

/** The signed-in user's notifications, newest first, bounded. */
export async function loadNotifications(supabase: Db): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, user_id, kind, title, body, href, read_at, archived_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
