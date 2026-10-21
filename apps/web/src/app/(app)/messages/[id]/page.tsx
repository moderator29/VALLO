import type { Metadata } from "next";
import { ShowMePanel } from "@/components/app/messages/ShowMePanel";
import { readShowMe } from "@/lib/messages/show-me-queries";
import { readChatHintGaps } from "@/lib/messages/hints-read";
import { notFound } from "next/navigation";
import { withNext } from "@/lib/auth/next-link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageHeader } from "@/components/app/PageHeader";
import { resolveSession } from "@/lib/actions/session";
import { isFeatureEnabled } from "@/lib/flags";
import { getThreadContext, loadThread, type ThreadContext } from "@/lib/messages/live";
import { readOpenInspectionForConversation } from "@/lib/inspections/queries";
import { ThreadView, type ThreadBubble } from "./ThreadView";
import { resolveCards } from "./cards";
import { readAvailabilityForConversation } from "@/lib/availability/queries";
import { AvailabilityCard } from "@/components/app/messages/AvailabilityCard";
import { readAccountMoment } from "@/lib/messages/account-moment-read";
import { counterpartFactsFrom, personFacts } from "@/lib/messages/person-line";
import { recordLines } from "@/lib/trust/record";
import { readThreadRecord } from "@/lib/trust/record-read";
import { readMyPassportOn } from "@/lib/passport/passport-read";
import { InboxEmpty } from "../Inbox";
import { readDeskStage } from "@/lib/enquiry/queries";
import { readFollowup } from "@/lib/enquiry/followup-queries";import { quickReplies } from "@/lib/enquiry/quick-replies";
import { renterQuestions } from "@/lib/enquiry/renter-questions";
import { loadListingsByIds } from "@/lib/listings/supabase-repository";
import { StageControl } from "@/components/app/messages/StageControl";
import { videoCallsOn } from "@/lib/calls/flags";
import { readThreadCalls } from "@/lib/calls/thread-calls";
import { callIdFromParam, callMarkerView } from "@/lib/calls/screen";

/**
 * A single conversation thread.
 *
 * Thin server shell. Signed in on a configured platform, the thread loads from
 * the database under the caller's own RLS (membership included) and renders
 * live. Signed out there is no thread to render, and this asks the reader to
 * sign in rather than inventing one.
 *
 * **It used to invent one, and this was the worse of the two routes that did.**
 * A signed-out visitor fell through to a seeded thread and got the whole
 * conversation: a named agent who does not exist, and `mine: m.author ===
 * "guest"` mapping half the bubbles to the visitor, so they were shown words
 * they had never written, attributed to them. `lib/messages/repository.ts`
 * carries the reasoning and no longer carries the fixture.
 *
 * Not-found is deliberately not the answer here. The conversation the link
 * points at may well exist and simply not be readable without a session, and
 * telling somebody a real thing does not exist is the same class of lie in the
 * other direction.
 */

/** Today in Lagos, `YYYY-MM-DD`, for the still-available date field (V-14). */
function lagosDayNow(): string {
  return new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Which end of the conversation the viewer is.
 *
 * `agent_id` is the lister on a listing thread, the restaurant on a
 * reservation thread and the property on a booking thread; `guest_id` is the
 * other side. Neither `loadThread` nor `getThreadContext` says which one the
 * caller is, so this asks the row directly under the caller's own RLS. Both
 * of those readers already select the two columns, so either could return
 * `viewerRole` and this read would go away.
 */
async function viewerRole(
  supabase: Parameters<typeof loadThread>[0],
  me: string,
  conversationId: string,
): Promise<"host" | "guest"> {
  const { data } = await supabase
    .from("conversations")
    .select("agent_id")
    .eq("id", conversationId)
    .maybeSingle();
  return data?.agent_id === me ? "host" : "guest";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  /* Every conversation is somebody's, so the title never names a counterpart:
     a tab title is the one piece of a private page that gets screenshotted,
     read over a shoulder and restored by the browser months later. */
  await params;
  return { title: getDictionary(await getLocale()).experienceInbox.threadPage.title };
}

/**
 * Which of my messages the other side has opened.
 *
 * `loadThread` does not carry `read_at` (its file is the messaging worker's),
 * so the ticks read it here: one bounded select under the caller's own RLS,
 * ids only. The line for that worker is that `LiveThreadMessage` should
 * carry `readAt` and this read goes away.
 */
async function readIds(
  supabase: Parameters<typeof loadThread>[0],
  conversationId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .not("read_at", "is", null)
    .limit(200);
  return new Set((data ?? []).map((row) => row.id));
}

/**
 * What this reader had not read when they arrived: how many messages from the
 * other side have no `read_at`, and which one is first (for the unread divider).
 *
 * Read on the server BEFORE the thread's own mark-read runs in the browser,
 * which is the only moment the answer exists: one bounded select under the
 * caller's own RLS, ids in time order. Null when nothing is unread, and on any
 * failed read, because a divider that is wrong is worse than none.
 */
async function readUnread(
  supabase: Parameters<typeof loadThread>[0],
  conversationId: string,
  me: string,
): Promise<{ count: number; firstId: string } | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .neq("sender_id", me)
    .is("read_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error || !data || data.length === 0) return null;
  return { count: data.length, firstId: data[0]!.id };
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attach?: string | string[]; showme?: string | string[]; call?: string | string[] }>;
}) {
  const { id } = await params;
  const { attach, showme: showMeParam, call: callParam } = await searchParams;
  /* The switch is read beside the session, not after it: it is one cached
     row either way, and in sequence it was a round trip before any of the
     thread's own reads could start. */
  const [session, messagingOn] = await Promise.all([resolveSession(), isFeatureEnabled("messaging")]);

  const inboxWords = getDictionary(await getLocale()).experienceInbox;

  if (session.state === "signed-in") {
    if (!messagingOn) {
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title={inboxWords.inbox.title} fallback="/messages" />
          <p className="nf-panel nf-panel--card p-lg text-center text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            {inboxWords.inbox.paused}
          </p>
        </div>
      );
    }

    if (!UUID_RE.test(id)) notFound();
    const locale = await getLocale();
    const t = getDictionary(locale);
    const [thread, contextRead, role, read, unread, callsOn, threadCalls] = await Promise.all([
      loadThread(session.supabase, session.user, id),
      getThreadContext(id),
      viewerRole(session.supabase, session.user.id, id),
      readIds(session.supabase, id),
      readUnread(session.supabase, id, session.user.id),
      /* VC1: whether to draw the call buttons, and which rows are calls. */
      videoCallsOn(),
      readThreadCalls(session.supabase, id),
    ]);
    if (!thread) notFound();
    /*
     * The context decides the banner. A read that came back null (a race with
     * the thread being removed, or a kind the query could not resolve) is a
     * plain listing thread with no banner rather than a broken one.
     */
    const context: ThreadContext = contextRead ?? { kind: "listing" };
    const listingThread = context.kind === "listing";
    const lagosToday = lagosDayNow();
    /* V-72: the desk, for the lister of a listing thread only. The stage read
       answers only for the caller's own threads, and the listing is read
       under the lister's own client for the quick replies' figures. */
    const desk = listingThread && role === "host";
    /* B6: the renter's question chips, on a listing thread nobody has written
       in yet. The listing is read for the same reason as the desk's: to leave
       out what it already answers. */
    const askChips = listingThread && role === "guest" && thread.messages.length === 0 && Boolean(thread.listing);
    /*
     * PERF-SWEEP 1: every read below depends only on the thread, its context
     * and the reader's role, all known by now, and on none of each other. They
     * used to run one after another, ten round trips in series before the
     * first bubble could draw; they now run together. Each keeps its own
     * guard and its own failure rule: the facts line and the desk listing
     * still fall back to nothing, and any other read that throws still takes
     * the page to its error boundary, exactly as before.
     */
    const [
      cards,
      inspection,
      availability,
      [stage, deskListing, followup],
      counterpartFactsLine,
      passportOn,
      recordRead,
      accountMoment,
      showMe,
      chatHintGaps,
    ] = await Promise.all([
      /* The shared listings and bookings, expanded into cards for this reader. */
      resolveCards(
        session.supabase,
        /* Who sent each message, so a passport card draws only for its owner. */
        thread.messages.map((m) => ({ id: m.id, body: m.body, senderId: m.mine ? thread.meId : thread.counterpartId })),
        locale,
      ),
      /* Only a listing thread can carry a live inspection; the other faces
         never ask, structurally. */
      listingThread ? readOpenInspectionForConversation(id) : null,
      /* V-14: the still-available question on this thread, if one was asked. */
      listingThread ? readAvailabilityForConversation(id) : null,
      desk || askChips
        ? Promise.all([
            desk ? readDeskStage(id) : Promise.resolve(null),
            thread.listing
              ? loadListingsByIds(session.supabase, [thread.listing.id])
                  .then((found) => found.get(thread.listing!.id) ?? null)
                  .catch(() => null)
              : Promise.resolve(null),
            /* AGENT-01: the follow-up date beside the stage, the lister's own. */
            desk ? readFollowup(session.supabase, id) : Promise.resolve(null),
          ])
        : ([null, null, null] as const),
      /* V-23: the dated facts about the other person, for the line under the
         header. One RPC that answers only to a party; a failure is no line. */
      (async (): Promise<{ key: string; text: string }[]> => {
        try {
          const { data: factsRows } = await (session.supabase as unknown as {
            rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown }>;
          }).rpc("thread_counterpart_facts", { p_conversation: id });
          const first = Array.isArray(factsRows) ? factsRows[0] : null;
          return personFacts(counterpartFactsFrom(first), t.trustVisible.person, locale);
        } catch {
          return [];
        }
      })(),
      /* The Vallo passport: whether the reader's own is on, so the options
         sheet offers "Show my passport" or the way to turn it on. */
      readMyPassportOn(),
      /* V-34: when the other party is a lister, their Record, counted, under
         the person line. */
      readThreadRecord(id),
      /* V-04: the receiver's account card. Skipped, at no cost, unless a
         message from the other side carries an account number. */
      listingThread
        ? readAccountMoment(session.supabase, {
            conversationId: id,
            meId: session.user.id,
            role,
            listingId: thread.listing?.id ?? null,
            messages: thread.messages,
            locale,
          })
        : null,
      /* V-69: a listing thread's clip asks, when the flag is open. */
      listingThread ? readShowMe(session.supabase, id) : null,
      /* The renter's hint card and chips: the gaps in this listing's own data.
         Null for anybody else, and for a stay, a table or a failed read. */
      readChatHintGaps(session.supabase, {
        contextKind: context.kind,
        role,
        listingId: thread.listing?.id ?? null,
      }),
    ]);
    /* "On Vallo since" is drawn once, small, under the line that keeps chats
       and payments inside Vallo (founder, 11 October 2026): taken out of the
       person line, and the Record's copy of it is not drawn either. No row,
       no line. */
    const sinceLine = counterpartFactsLine.find((fact) => fact.key === "since")?.text ?? null;
    const personLine = counterpartFactsLine.filter((fact) => fact.key !== "since");
    const counterpartRecordLine = recordLines(recordRead, t.trustVisible.record, locale).filter(
      (line) => line.key !== "since",
    );

    return (
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live
        conversationId={thread.conversationId}
        meId={thread.meId}
        context={context}
        inspection={inspection}
        role={role}
        threadCopy={t.threads}
        inboxThreadCopy={t.experienceInbox.thread}
        locale={locale}
        /*
          THE COUNTERPART'S BADGE, AND THE DEFECT THAT USED TO BE ON THIS LINE.

          This read `thread.listing?.verified`. That key sits on the LISTING
          object and is a fact about a PROPERTY, and it was being handed to the
          component that draws the mark beside a PERSON'S name, on the screen
          where somebody decides whether to send a stranger a deposit. The note
          that stood here argued it was "the same value" because `loadThread`
          happened to file the person's badge under that key, and it named the
          cost it could see: a direct message with no listing attached carried
          nothing, so a checked agent messaging outside a listing showed no
          mark at all. It needed a top-level field.

          That field now exists. `loadThread` returns `counterpartTier`, the
          published `public.person_badge.tier`, beside `counterpartName`, and
          this line is it. A thread with no listing draws the right mark, and
          the property's own badge can never again stand in for a human check.
          `VerifiedAvatar`'s own docstring had been warning against exactly this
          substitution while this call site was performing it.
        */
        counterpartTier={thread.counterpartTier}
        counterpartName={thread.counterpartName}
        /* Null unless `lib/security/counterpart-contact.ts` allowed it: RLS
           membership first, a block in either direction withholds it, every
           failure withholds. The header draws no call control on null. */
        counterpartPhone={thread.counterpartPhone}
        /* The other party's id, resolved under the same RLS membership check
           that made this reader a party at all. It exists so the options
           sheet can offer Block, which before this had no id to act on. */
        counterpartId={thread.counterpartId}
        counterpartHandle={thread.counterpartHandle}
        /* The photos at the head of each run of bubbles and in the header:
           theirs and the reader's own, or the initial on the brand tint. */
        counterpartAvatarUrl={thread.counterpartAvatarUrl}
        meName={thread.meName}
        meAvatarUrl={thread.meAvatarUrl}
        listing={
          thread.listing
            ? {
                id: thread.listing.id,
                title: thread.listing.title,
                area: thread.listing.area,
                city: thread.listing.city,
                verified: thread.listing.verified,
                approved: true,
                hue: thread.listing.hue,
              }
            : null
        }
        inspected={thread.inspected}
        availabilitySlot={
          availability ? (
            <AvailabilityCard
              check={availability}
              copy={t.frontDoor.available}
              locale={locale}
              today={lagosToday}
            />
          ) : null
        }
        stageSlot={
          stage ? (
            <StageControl
              conversationId={id}
              stage={stage}
              copy={t.frontDoor.desk}
              followup={{ dueOn: followup?.dueOn ?? null, note: followup?.note ?? null }}
              today={lagosToday}
              followupCopy={t.workspaceDash.followup}
              locale={locale}
            />
          ) : null
        }
        quickReplies={
          desk
            ? quickReplies(deskListing, t.frontDoor.desk.quick, locale)
            : askChips
              ? renterQuestions(deskListing, t.memberKit.questions)
              : []
        }
        quickRepliesTitle={desk ? t.frontDoor.desk.quickTitle : t.memberKit.questions.title}
        chatHints={
          chatHintGaps && thread.listing
            ? {
                data: {
                  gaps: chatHintGaps,
                  visitOpen: inspection !== null && inspection !== undefined,
                  visitHref: `/listing/${thread.listing.id}/visit`,
                },
                copy: t.chatHints,
              }
            : null
        }
        openAttach={(Array.isArray(attach) ? attach[0] : attach) === "1"}
        accountMoment={accountMoment}
        personLine={personLine}
        sinceLine={sinceLine}
        recordLine={counterpartRecordLine}
        passport={{
          /* Unknown counts as off: the sheet then points at the passport page
             rather than posting a card that could not open. */
          on: passportOn === true,
          words: {
            show: t.passportV2.showInChat,
            hint: t.passportV2.showInChatHint,
            offTitle: t.passportV2.showInChatOff,
            offHint: t.passportV2.showInChatOffHint,
            sent: t.passportV2.shownInChat,
            failed: t.passportV2.sendFailed,
            viewTheirs: t.passportV2.viewTheirs,
            viewTheirsHint: t.passportV2.viewTheirsHint,
          },
        }}
        recordLabel={t.trustVisible.record.title}
        showMe={
          showMe ? (
            <ShowMePanel
              conversationId={thread.conversationId}
              role={role}
              requests={showMe.requests}
              canAsk={showMe.canAsk}
              copy={t.shape.showMe}
              locale={locale}
              now={renderedAt()}
              openOnArrival={(Array.isArray(showMeParam) ? showMeParam[0] : showMeParam) === "1"}
            />
          ) : null
        }
        personLabel={t.trustVisible.person.label}
        unread={unread}
        nowMs={Date.parse(renderedAt())}
        accountCopy={t.trustVisible.account}
        scamCopy={t.memberKit.scam}
        dayKitCopy={t.memberKit.dayKit}
        calls={{ copy: t.calls, enabled: callsOn, words: t.chatPolish.calls }}
        viewerCopy={t.chatPolish.viewer}
        messages={thread.messages.map((m): ThreadBubble => {
          const card = cards.get(m.id);
          const callId = threadCalls.markers.get(m.id);
          const callView = callId
            ? callMarkerView({ body: m.body, mine: m.mine, snapshot: threadCalls.calls.get(callId) ?? null })
            : null;
          return {
            ...(callId && callView ? { call: { callId, view: callView } } : {}),
            id: m.id,
            mine: m.mine,
            body: m.body,
            timeLabel: m.timeLabel,
            imageUrl: m.imageUrl,
            imageSize: m.imageSize ?? null,
            read: read.has(m.id),
            ...(m.createdAt ? { createdAt: m.createdAt } : {}),
            ...(card ? { card } : {}),
          };
        })}
      />
    );
  }

  // -------------------------------------------------------- nobody signed in
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={inboxWords.threadPage.title} fallback="/messages" />
      {/* "Sign in and it opens where you left it": so the link carries this
          conversation back (it went to a bare /sign-in, Round 3 sweep). */}
      <InboxEmpty
        title={inboxWords.threadPage.signedOutTitle}
        body={inboxWords.threadPage.signedOutBody}
        action={{
          /* A push tap for a call carries `?call=`; it survives the sign in,
             so the call opens after auth (the call layer resolves it). */
          href: withNext(
            "/sign-in",
            `/messages/${encodeURIComponent(id)}${callIdFromParam(callParam) ? `?call=${callIdFromParam(callParam)}` : ""}`,
          ),
          label: inboxWords.inbox.signIn,
        }}
        secondary={{ href: "/search", label: inboxWords.inbox.explore }}
      />
    </div>
  );
}

/** The server's clock, read once per request, outside render purity rules. */
function renderedAt(): string {
  return new Date().toISOString();
}
