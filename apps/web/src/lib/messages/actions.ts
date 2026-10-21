"use server";

/**
 * The messaging loop: start a conversation, send, attach, confirm inspection,
 * mark read.
 *
 * Every write runs under the sender's own RLS-bound client, so the database is
 * the authority on membership: a message into a conversation the caller does
 * not belong to is refused by policy, not by application code. The database
 * triggers own the fan-out: a message insert bumps the conversation's
 * last_message_at and writes the other participant's notification row, so no
 * code path here can forget either. Marking a thread read is the one place the
 * service role appears, because participants deliberately hold no UPDATE
 * policy on messages; membership is proven through an RLS read first.
 *
 * One durable throttle lives here: how many brand new conversations a guest may
 * open in a day, so mass first-message scraping of agents' contacts is not free.
 * Sending inside an existing thread is never throttled.
 */

import { oncePerTap, tapKey } from "../offline/replay-guard";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import { setupExempt } from "../actions/setup-exempt";
import { isFeatureEnabled } from "../flags";
import { getListingRepository } from "../listings/repository";
import { reservationHostUserId, reservationSpine } from "../reservations/host";
import { consume, subjectForUser } from "../security/rate-limit";
import { checkAccountAfterSend } from "./account-check-run";
import { isAccountMoment } from "./account-moment";
import { createAdminClient } from "../supabase/admin";
import {
  BLOCKED_MESSAGE,
  BLOCKED_THREAD_MESSAGE,
  blockedBetween,
  guardConversation,
} from "./blocks";
import {
  attachImageSchema,
  confirmInspectionSchema,
  markThreadReadSchema,
  sendMessageSchema,
  startBookingThreadSchema,
  startConversationSchema,
  startReservationThreadSchema,
} from "./schema";
import { dbLimitRefusal } from "../security/db-limit";
import { phoneGateFor } from "../phone-otp/gate";
import { pathInOwnFolder } from "../security/own-folder";
import { attributeConversation } from "../share/attribution";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAUSED_MESSAGE = "Messaging is paused for maintenance. Please try again in a little while.";

/*
 * "Messaging opens for this listing the moment it goes live on the platform.
 * Save it and check back soon" was two false statements in one sentence. An
 * example listing never goes live, so "check back soon" is a date nobody can
 * keep, and it is the banned "coming soon" wearing a different coat. See
 * F2-003. The reader gets the fact and the one step that works instead.
 */
const SEED_LISTING_MESSAGE =
  "This is an example listing, so there is no agent to write to. Open a real listing from search and message the agent from there.";

/**
 * The claims rule applies to error copy too. "We could not find this listing"
 * was once shown for a query that FAILED (an ambiguous join), and the founder
 * read it as his catalogue being deleted. A failed read now says only that the
 * chat could not open; "no longer exists" is said only after the service role
 * has confirmed there is no such row.
 */
const CHAT_DID_NOT_OPEN_MESSAGE =
  "This chat did not open just now. Nothing has changed on the listing. Please try again in a moment.";

const LISTING_NOT_OPEN_MESSAGE =
  "This listing is not taking messages right now. Explore other places from search.";

const UNKNOWN_LISTING_MESSAGE =
  "This listing no longer exists. Explore other places from search.";

const NOT_YOUR_CONVERSATION_MESSAGE =
  "That conversation is not on your account. Open your inbox to see the conversations you are part of.";

const SEND_FAILED_MESSAGE = "Your message did not send. Tap retry to send it again.";

/**
 * Marking read is a background courtesy, not the thing the reader came for, so
 * the message has to say the one thing they would worry about (their messages
 * are still there) and the one thing they can do (try again).
 */
const READ_STATE_FAILED_MESSAGE =
  "We could not mark these as read just now. Every message is still in your inbox. Try again in a moment.";

/** The body a photo-only message carries. */
const PHOTO_BODY = "\u{1F4F7} Photo";

/**
 * How many brand new conversations one guest may open in a day
 * (RECOMMENDATIONS R-36).
 *
 * The abuse this prices is scraping agents' contact details through mass first
 * messages: opening a thread is what costs an agent their attention, so opening
 * threads is what gets counted. Twenty in a day is far above any real search
 * (a guest comparing hard messages a handful of agents about a handful of
 * places) and far below anything worth scripting.
 *
 * What is deliberately NOT limited: sending inside a conversation that already
 * exists. A real negotiation over a Lagos shortlet is chatty, runs over hours,
 * and gets re-sent whenever the network drops. Throttling that would punish
 * exactly the users the platform wants. Only creation is counted, and only when
 * a row is actually about to be created: reopening a thread that already exists
 * costs a guest nothing.
 */
const NEW_CONVERSATION_LIMIT = 20;
const NEW_CONVERSATION_WINDOW_SECONDS = 24 * 60 * 60;

function newConversationLimitMessage(retryIn: string): string {
  return `You have opened ${NEW_CONVERSATION_LIMIT} new conversations today, which is the daily limit while we keep agents' inboxes usable. Your existing chats are unaffected, and you can open new ones ${retryIn}.`;
}

/**
 * Find or create the guest's conversation with the agent of a listing.
 *
 * The listing is read through the caller's own client, so only PUBLISHED
 * listings (or the caller's own) resolve. The agent's user id sits behind
 * agents RLS, which is select-own only, so a guest's embedded read comes back
 * empty and the service role finishes the lookup; nothing is written until
 * both parties are known. The unique (guest, agent, listing) triple makes the
 * find-or-create race-safe: a concurrent insert surfaces as 23505 and the
 * existing thread is returned instead.
 */
export async function startConversation(input: {
  listingId: string;
}): Promise<ActionResult<{ conversationId: string }>> {
  const found = await findOrStartConversation(input, true);
  if (!found.ok) return found;
  return found.data.conversationId
    ? ok({ conversationId: found.data.conversationId })
    : fail("We could not open this conversation just now. Please try again.");
}

/**
 * UX-P2-03: the "Message" page looks, it does not write. Every check the
 * start makes (the listing, the agent, your own listing, a block), and an
 * existing thread comes back; nothing is created and the daily count is not
 * touched. `conversationId` is null when there is no thread yet: the page
 * shows a first-message box, and the thread is made when that is sent.
 */
export async function findConversationForListing(input: {
  listingId: string;
}): Promise<ActionResult<{ conversationId: string | null }>> {
  /* B-2: a lookup that starts nothing, so the finish-setup hold is lifted. */
  return setupExempt(() => findOrStartConversation(input, false));
}

/**
 * UX-P2-03: the first message makes the thread. Opens (or finds) the
 * conversation and sends the message in one call, so an abandoned "Message"
 * tap leaves nothing behind in either inbox.
 */
export async function startConversationWithMessage(input: {
  listingId: string;
  body: string;
}): Promise<ActionResult<{ conversationId: string }>> {
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if (!body) return fail("Type a message before sending.", { body: "Type a message before sending." });
  const started = await startConversation({ listingId: input.listingId });
  if (!started.ok) return started;
  /* V-71: credit the lister whose link this device first came through, now
     that the thread exists. Best effort: no credit is the only cost. */
  const session = await resolveSession();
  if (session.state === "signed-in") await attributeConversation(session.supabase, started.data.conversationId);
  const sent = await sendMessage({ conversationId: started.data.conversationId, body });
  /* Whole, so a phone-gate refusal keeps its button. */
  if (!sent.ok) return sent;
  return ok({ conversationId: started.data.conversationId });
}

/**
 * A listing the reader cannot see is not proof it is gone: it may be paused,
 * under review, or the read may have been refused. Only a service-role read
 * that finds no row at all earns "no longer exists".
 */
async function absentListingMessage(listingId: string): Promise<string> {
  try {
    const { data, error } = await createAdminClient()
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .maybeSingle();
    if (error) return CHAT_DID_NOT_OPEN_MESSAGE;
    return data ? LISTING_NOT_OPEN_MESSAGE : UNKNOWN_LISTING_MESSAGE;
  } catch {
    return CHAT_DID_NOT_OPEN_MESSAGE;
  }
}

async function findOrStartConversation(
  input: { listingId: string },
  create: boolean,
): Promise<ActionResult<{ conversationId: string | null }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(startConversationSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId } = parsed.data;

  // Seed catalogue entries render pages but do not exist in the database, so
  // there is no agent inbox behind them. Honest refusal, never a fake thread.
  if (!UUID_RE.test(listingId)) {
    const seed = await getListingRepository().byId(listingId);
    return fail(seed ? SEED_LISTING_MESSAGE : UNKNOWN_LISTING_MESSAGE);
  }

  const { data: listing, error: listingError } = await session.supabase
    .from("listings")
    .select("id, title, agent_id, agents!listings_agent_id_fkey(user_id)")
    .eq("id", listingId)
    .maybeSingle();
  if (listingError) return fail(CHAT_DID_NOT_OPEN_MESSAGE);
  if (!listing) return fail(await absentListingMessage(listingId));

  // Guests cannot read the agents row under RLS; the service role resolves
  // the counterpart after the listing itself has passed the RLS read above.
  let agentUserId: string | null = listing.agents?.user_id ?? null;
  if (!agentUserId) {
    try {
      const admin = createAdminClient();
      const { data: agent } = await admin
        .from("agents")
        .select("user_id")
        .eq("id", listing.agent_id)
        .maybeSingle();
      agentUserId = agent?.user_id ?? null;
    } catch {
      agentUserId = null;
    }
  }
  if (!agentUserId) {
    return fail("The agent for this listing is not reachable right now. Please try again shortly.");
  }
  if (agentUserId === session.user.id) {
    return fail(
      "This is your own listing, so there is no agent to message. Open it from your listings to manage it.",
    );
  }

  // Before the find as well as the create: reopening an old thread across a
  // block is still writing to somebody who asked not to hear from you.
  if (await blockedBetween(session.supabase, session.user.id, agentUserId)) {
    return fail(BLOCKED_THREAD_MESSAGE);
  }

  const { data: existing, error: findError } = await session.supabase
    .from("conversations")
    .select("id")
    .eq("guest_id", session.user.id)
    .eq("agent_id", agentUserId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (findError) return fail("Messaging is unavailable just now. Please try again shortly.");
  if (existing) return ok({ conversationId: existing.id });
  if (!create) return ok({ conversationId: null });

  /* FULL GATE (13 October 2026): the first message that opens a new
     conversation needs a confirmed phone, flag on. Before the thread is made,
     so a refusal leaves nothing in either inbox and costs no daily count. */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "message");
  if (phoneGate) return phoneGate;

  // A row is genuinely about to be created, so this is the moment the daily
  // count applies. The limiter fails open, so a limiter outage can never stop a
  // guest reaching an agent.
  const verdict = await consume({
    bucket: "conversation_new",
    subject: subjectForUser(session.user.id),
    limit: NEW_CONVERSATION_LIMIT,
    windowSeconds: NEW_CONVERSATION_WINDOW_SECONDS,
  });
  if (!verdict.allowed) return fail(newConversationLimitMessage(verdict.retryIn));

  /* `conversations.agent_id` is the host's AUTH USER id, not an `agents.id`
     (docs/schema/NAMES.md), which is why it takes `agentUserId`. */
  const { data: created, error: insertError } = await session.supabase
    .from("conversations")
    .insert({ guest_id: session.user.id, agent_id: agentUserId, listing_id: listingId })
    .select("id")
    .single();

  if (insertError || !created) {
    if (insertError?.code === "23505") {
      // Lost the race to ourselves in another tab: the thread now exists.
      const { data: raced } = await session.supabase
        .from("conversations")
        .select("id")
        .eq("guest_id", session.user.id)
        .eq("agent_id", agentUserId)
        .eq("listing_id", listingId)
        .maybeSingle();
      if (raced) return ok({ conversationId: raced.id });
    }
    // SEC-P2-02: the database holds the same daily count, and it does not fail
    // open. 54000 is that limit; say so rather than "try again".
    if (insertError?.code === "54000") return fail(newConversationLimitMessage("tomorrow"));
    return fail("We could not open this conversation just now. Please try again.");
  }

  return ok({ conversationId: created.id });
}

/* ------------------------------------------------------------ context threads */

const CONTEXT_THREAD_DOWN_MESSAGE =
  "We could not open this conversation just now. Please try again.";

const NOT_YOUR_TRANSACTION_MESSAGE =
  "That is not on your account, so there is no conversation to open. Check your trips to see the ones that are.";

/**
 * Find or create the thread attached to one reservation or one booking.
 *
 * The transaction object is read through the caller's own client, so only a
 * guest or the host of that reservation or booking resolves it at all. The
 * counterpart is then resolved exactly as startConversation does it: the
 * host's user id sits behind agents RLS, so a guest's embedded read comes back
 * empty and the service role finishes the lookup; the host reads their own
 * agents row and the guest id is on the transaction. Nothing is written until
 * both parties are known, and the database's party-validation trigger checks
 * them again on the insert, so a wrong pair can never land.
 *
 * The partial unique index on the transaction id makes find-or-create
 * race-safe: a concurrent insert surfaces as 23505 and the existing thread is
 * returned instead. There is deliberately no daily limiter here: a thread
 * keyed to a transaction the caller already holds cannot be used to scrape
 * anybody, so it bypasses the listing-thread throttle by construction.
 */
async function startContextThread(
  kind: "reservation" | "booking",
  transactionId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  const column = kind === "reservation" ? "reservation_id" : "booking_id";

  // The transaction, under RLS. A row the caller is not a party to does not
  // come back, and that is the whole authorisation.
  const read =
    kind === "reservation"
      ? await session.supabase
          .from("reservations")
          .select(
            "id, guest_id, listing_id, business_id, listings(agent_id, agents!listings_agent_id_fkey(user_id)), businesses(owner_id)",
          )
          .eq("id", transactionId)
          .maybeSingle()
      : await session.supabase
          .from("bookings")
          .select("id, guest_id, listing_id, listings(agent_id, agents!listings_agent_id_fkey(user_id))")
          .eq("id", transactionId)
          .maybeSingle();
  if (read.error) return fail(CONTEXT_THREAD_DOWN_MESSAGE);
  const transaction = read.data;
  if (!transaction) return fail(NOT_YOUR_TRANSACTION_MESSAGE);

  // The host, on either spine: the listing's agent as a user, or, for a table
  // at a first-party business (M7, listing_id null), the business's owner.
  // That is the pair the b3 party check admits, and it is resolved here by
  // the same rule (`reservationHostUserId`) so the insert below cannot name a
  // person the trigger would refuse.
  let hostUserId: string | null = reservationHostUserId(transaction);
  if (!hostUserId && transaction.listings?.agent_id) {
    try {
      const admin = createAdminClient();
      const { data: agent } = await admin
        .from("agents")
        .select("user_id")
        .eq("id", transaction.listings.agent_id)
        .maybeSingle();
      hostUserId = agent?.user_id ?? null;
    } catch {
      hostUserId = null;
    }
  }
  if (!hostUserId && kind === "reservation") {
    // A business is readable to a guest only while PUBLISHED, so the embed
    // can come back empty for a table at a venue that has since come down.
    // The reservation itself passed the caller's own read above; the owner
    // is then resolved by the service role, exactly as the agent is.
    const spine = reservationSpine(transaction);
    if (spine?.kind === "business") {
      try {
        const admin = createAdminClient();
        const { data: business } = await admin
          .from("businesses")
          .select("owner_id")
          .eq("id", spine.businessId)
          .maybeSingle();
        hostUserId = business?.owner_id ?? null;
      } catch {
        hostUserId = null;
      }
    }
  }
  if (!hostUserId) {
    return fail("The host is not reachable right now. Please try again shortly.");
  }

  const guestId = transaction.guest_id;
  if (session.user.id !== guestId && session.user.id !== hostUserId) {
    return fail(NOT_YOUR_TRANSACTION_MESSAGE);
  }
  if (guestId === hostUserId) {
    return fail("This is your own booking, so there is nobody else to message.");
  }
  if (await blockedBetween(session.supabase, session.user.id, session.user.id === guestId ? hostUserId : guestId)) {
    return fail(BLOCKED_THREAD_MESSAGE);
  }

  const { data: existing, error: findError } = await session.supabase
    .from("conversations")
    .select("id")
    .eq(column, transactionId)
    .maybeSingle();
  if (findError) return fail("Messaging is unavailable just now. Please try again shortly.");
  if (existing) return ok({ conversationId: existing.id });

  const { data: created, error: insertError } = await session.supabase
    .from("conversations")
    .insert({
      guest_id: guestId,
      agent_id: hostUserId,
      context_kind: kind,
      ...(kind === "reservation"
        ? { reservation_id: transactionId }
        : { booking_id: transactionId }),
    })
    .select("id")
    .single();

  if (insertError || !created) {
    if (insertError?.code === "23505") {
      // Lost the race to ourselves in another tab: the thread now exists.
      const { data: raced } = await session.supabase
        .from("conversations")
        .select("id")
        .eq(column, transactionId)
        .maybeSingle();
      if (raced) return ok({ conversationId: raced.id });
    }
    // 23514 is the party-validation trigger or the shape check: the database
    // disagreed about who this transaction belongs to, which cannot happen
    // through this action but is refused honestly if it does.
    if (insertError?.code === "23514") return fail(NOT_YOUR_TRANSACTION_MESSAGE);
    return fail(CONTEXT_THREAD_DOWN_MESSAGE);
  }

  return ok({ conversationId: created.id });
}

/** Find or create the thread attached to one restaurant reservation. */
export async function startReservationThread(input: {
  reservationId: string;
}): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = validate(startReservationThreadSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  return startContextThread("reservation", parsed.data.reservationId);
}

/** Find or create the thread attached to one stay booking. */
export async function startBookingThread(input: {
  bookingId: string;
}): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = validate(startBookingThreadSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  return startContextThread("booking", parsed.data.bookingId);
}

/** What a successful send hands back for the optimistic bubble to adopt. */
export type SentMessage = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
};

/** What a replayed send answers (V-40): the id, thread and time, never the words. */
export type ReplayedMessage = Pick<SentMessage, "id" | "conversationId" | "createdAt">;

/**
 * Send a message. One insert under the sender's RLS client; the database
 * triggers bump the conversation, notify the other participant and run the
 * safety pipeline. The only thing done first is the block check, in words:
 * the restrictive insert policy refuses the row anyway, but a person who has
 * been blocked deserves a sentence rather than "did not send, tap retry".
 */
export async function sendMessage(input: {
  conversationId: string;
  body: string;
  /** The message this one answers, in the same conversation (the database checks). */
  replyToId?: string | null;
  /** V-40: the UUID minted when this was tapped; a replay answers with the first send. */
  tapKey?: string;
}): Promise<ActionResult<SentMessage | ReplayedMessage>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  /* Kept for replay: the id, the thread and the time, never the words. */
  return oncePerTap(
    "outbox.message",
    session.user.id,
    tapKey(input.tapKey),
    () =>
      sendMessageWork(session, {
        conversationId: input.conversationId,
        body: input.body,
        replyToId: input.replyToId ?? null,
      }),
    (sent): ReplayedMessage => ({ id: sent.id, conversationId: sent.conversationId, createdAt: sent.createdAt }),
  );
}

async function sendMessageWork(
  session: Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>,
  input: { conversationId: string; body: string; replyToId: string | null },
): Promise<ActionResult<SentMessage>> {

  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(sendMessageSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const guard = await guardConversation(session.supabase, session.user.id, parsed.data.conversationId);
  if (!guard.ok) {
    if (guard.reason === "blocked") return fail(BLOCKED_MESSAGE);
    if (guard.reason === "not_yours") return fail(NOT_YOUR_CONVERSATION_MESSAGE);
    return fail(SEND_FAILED_MESSAGE);
  }

  /* FULL GATE: the first words in a conversation nobody has written in yet
     (a booking or table thread, a direct chat). A reply in a thread somebody
     else started is never held. */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "message", {
    conversationId: parsed.data.conversationId,
  });
  if (phoneGate) return phoneGate;

  const { data: row, error } = await session.supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: session.user.id,
      body: parsed.data.body,
      reply_to_id: parsed.data.replyToId ?? null,
    })
    .select("id, conversation_id, body, created_at")
    .single();

  if (error || !row) {
    if (error?.code === "42501") return fail(NOT_YOUR_CONVERSATION_MESSAGE);
    const limited = dbLimitRefusal(error);
    if (limited) return fail(limited);
    return fail(SEND_FAILED_MESSAGE);
  }

  /*
   * V-04, THE ACCOUNT-NUMBER MOMENT. When the message carries a ten-digit
   * account number, the receiver is told whether it belongs to the lister
   * Vallo verified. The check calls the payment processor, so it runs AFTER
   * the response through `after()`: the message is already in, and nothing
   * about the check can delay or refuse it. It stores a boolean and the last
   * four digits, never the number or the resolved name, and the sender never
   * sees the answer. See `account-check.ts`.
   */
  if (isAccountMoment(row.body)) {
    const sent = { messageId: row.id, conversationId: row.conversation_id, senderId: session.user.id, body: row.body };
    after(() => checkAccountAfterSend(sent));
  }

  return ok({
    id: row.id,
    conversationId: row.conversation_id,
    body: row.body,
    createdAt: row.created_at,
  });
}

/**
 * Record an image attachment after the client has uploaded it to the private
 * message-attachments bucket. When no message id is given the photo gets its
 * own message first, so it lands in the thread and notifies like any other.
 * The storage path must sit inside this conversation's folder; a path
 * claiming another folder is refused before any write.
 */
export async function attachImage(input: {
  conversationId: string;
  messageId?: string;
  storagePath: string;
  width?: number;
  height?: number;
}): Promise<ActionResult<{ messageId: string; attachmentId: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(attachImageSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;

  if (!pathInOwnFolder(data.conversationId, data.storagePath)) {
    return fail("This photo does not belong to this conversation. Choose the photo again.");
  }

  /*
   * THE GUARD MOVED OUT OF THE `if`, AND THAT WAS A REAL HOLE.
   *
   * It used to run only on the branch that mints a new message. The other
   * branch attaches to a message the caller has already sent, and the
   * restrictive policy from the b5 migration is on `messages`, not on
   * `message_attachments`, so after a block a person could still hang a
   * photograph off one of their own older messages and have it appear in the
   * thread of the person who blocked them. A picture is the thing a block
   * exists to stop. Both branches ask now, and the twin restrictive policy on
   * `message_attachments` is the wall behind the sentence.
   */
  const guard = await guardConversation(session.supabase, session.user.id, data.conversationId);
  if (!guard.ok) {
    if (guard.reason === "blocked") return fail(BLOCKED_MESSAGE);
    if (guard.reason === "not_yours") return fail(NOT_YOUR_CONVERSATION_MESSAGE);
    return fail("Your photo did not send. Tap retry to send it again.");
  }

  let messageId = data.messageId ?? null;
  if (!messageId) {
    /* A photo can be the first message of a conversation too. */
    const phoneGate = await phoneGateFor(session.supabase, session.user.id, "message", {
      conversationId: data.conversationId,
    });
    if (phoneGate) return phoneGate;
    const { data: message, error: messageError } = await session.supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: session.user.id,
        body: PHOTO_BODY,
      })
      .select("id")
      .single();
    if (messageError || !message) {
      if (messageError?.code === "42501") return fail(NOT_YOUR_CONVERSATION_MESSAGE);
      const limited = dbLimitRefusal(messageError);
      if (limited) return fail(limited);
      return fail("Your photo did not send. Tap retry to send it again.");
    }
    messageId = message.id;
  }

  const { data: attachment, error: attachError } = await session.supabase
    .from("message_attachments")
    .insert({
      message_id: messageId,
      storage_path: data.storagePath,
      width: data.width ?? null,
      height: data.height ?? null,
    })
    .select("id")
    .single();

  if (attachError || !attachment) {
    // RLS refuses attachments onto messages the caller did not send.
    return fail("Your photo did not send. Tap retry to send it again.");
  }

  return ok({ messageId, attachmentId: attachment.id });
}

/**
 * Record, inside the conversation, that the guest has inspected the property.
 * One row per person per conversation; doing it twice gets the honest answer.
 */
export async function confirmInspection(input: {
  conversationId: string;
  listingId: string;
}): Promise<ActionResult<{ confirmedAt: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(confirmInspectionSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: row, error } = await session.supabase
    .from("inspection_confirmations")
    .insert({
      conversation_id: parsed.data.conversationId,
      listing_id: parsed.data.listingId,
      user_id: session.user.id,
    })
    .select("confirmed_at")
    .single();

  if (error || !row) {
    if (error?.code === "23505") return fail("You have already confirmed inspection here.");
    if (error?.code === "42501") return fail(NOT_YOUR_CONVERSATION_MESSAGE);
    /* The demo trigger on inspection_confirmations, in its own words. An
       example listing can be messaged about but never inspected, and "did not
       save, please try again" would send somebody back to a door that is
       walled up. */
    if (error?.code === "23514" && /example/i.test(error.message)) {
      return fail(
        "This is an example listing, so there is nothing to have inspected. Open a real listing from search.",
      );
    }
    return fail("Your confirmation did not save. Please try again.");
  }

  return ok({ confirmedAt: row.confirmed_at });
}

/**
 * Mark the other party's unread messages in this thread as read.
 *
 * Participants hold no UPDATE policy on messages by design, so the write goes
 * through the service role, strictly after the caller's own RLS client has
 * proven they are one of the two participants. Only messages addressed to the
 * caller are touched; their own sent messages keep whatever state the other
 * side gives them.
 */
export async function markThreadRead(input: {
  conversationId: string;
}): Promise<ActionResult<{ updated: number }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(markThreadReadSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  // Membership proof under the caller's own RLS. Admins can read conversations
  // they are not in, so the participant check is explicit, not implied.
  const { data: conversation, error: readError } = await session.supabase
    .from("conversations")
    .select("id, guest_id, agent_id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (readError) return fail(READ_STATE_FAILED_MESSAGE);
  if (
    !conversation ||
    (conversation.guest_id !== session.user.id && conversation.agent_id !== session.user.id)
  ) {
    return fail(NOT_YOUR_CONVERSATION_MESSAGE);
  }

  try {
    const admin = createAdminClient();
    const { data: updated, error: updateError } = await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id)
      .neq("sender_id", session.user.id)
      .is("read_at", null)
      .select("id");
    if (updateError) return fail(READ_STATE_FAILED_MESSAGE);
    return ok({ updated: updated?.length ?? 0 });
  } catch {
    return fail(READ_STATE_FAILED_MESSAGE);
  }
}

/**
 * Mark everything in the inbox as read, in one act.
 *
 * The thread route already marks one conversation read on open, which is the
 * right behaviour and the wrong ergonomics for somebody looking at eleven bold
 * rows they have already dealt with elsewhere. Same rules as markThreadRead:
 * the caller's own RLS client decides which conversations are theirs, and only
 * then does the service role clear the read state on messages addressed to
 * them. Their own sent messages are never touched.
 */
export async function markInboxRead(): Promise<ActionResult<{ updated: number }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  /* SEC-02. RLS alone also answers every conversation to an admin, so the
     caller is named as a party: an admin's "Mark all read" marks only their
     own threads, never another member's. */
  const { data: conversations, error: readError } = await session.supabase
    .from("conversations")
    .select("id")
    .or(`guest_id.eq.${session.user.id},agent_id.eq.${session.user.id}`)
    .limit(200);
  if (readError) return fail(READ_STATE_FAILED_MESSAGE);
  const ids = (conversations ?? []).map((row) => row.id);
  if (ids.length === 0) return ok({ updated: 0 });

  try {
    const admin = createAdminClient();
    const { data: updated, error: updateError } = await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("conversation_id", ids)
      .neq("sender_id", session.user.id)
      .is("read_at", null)
      .select("id");
    if (updateError) return fail(READ_STATE_FAILED_MESSAGE);

    revalidatePath("/messages");
    return ok({ updated: updated?.length ?? 0 });
  } catch {
    return fail(READ_STATE_FAILED_MESSAGE);
  }
}
