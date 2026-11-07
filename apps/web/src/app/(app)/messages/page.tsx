import type { Metadata } from "next";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { resolveSession } from "@/lib/actions/session";
import { isFeatureEnabled } from "@/lib/flags";
import { loadConversationSummaries } from "@/lib/messages/live";
import { loadInboxViews } from "@/lib/messages/inbox-views";
import { getSide } from "@/lib/side";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/app/PageHeader";
import { PageScene } from "@/components/app/PageScene";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { withNext } from "@/lib/auth/next-link";
import { Inbox, InboxEmpty, type InboxRow, type SupportInboxRow } from "./Inbox";
import { loadMyTickets } from "@/lib/support/my-tickets";
import { loadConversationPrefs } from "@/lib/messages/conversation-prefs-read";
import { lagosWhenLabel } from "@/lib/messages/time";
import { previewLine } from "@/components/app/messages/preview";
import { markerIds } from "@/lib/calls/thread-calls";
import { inboxMissedCall, parseCallMarker } from "@/lib/calls/screen";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceInbox.inbox.title };
}

/**
 * The Inbox: every conversation the reader is part of.
 *
 * It was called Messages, and it was a header with a flat list under it. The
 * word and the shape both changed: an inbox is a place you work through, so it
 * has a search field, a way to hold people you have never spoken to apart from
 * people you have, a compose button, and one act that clears the lot.
 *
 * Signed in on a configured platform the rows are real conversations under RLS
 * with real unread state. Signed out there is nothing, and this now says so.
 *
 * **It used to show a stranger somebody else's inbox.** Falling through to
 * `getMessageRepository()` served three invented conversations with named
 * agents about real listings, through this exact component, with no label
 * anywhere on the page. The agent repository had already decided the principle
 * when it deleted its own seeded agent, back in August: identity is the one
 * thing a "designed figures" label cannot rescue. That file is itself gone now,
 * which is why this says what it decided rather than where to read it. So the fixture is deleted rather than
 * labelled, and what a signed-out reader gets is the truth plus the two ways
 * in.
 *
 * An empty inbox with a search field and two tabs would be a worse answer than
 * this panel. There is nothing to search and no request to sort, and offering
 * the controls of a thing somebody does not have is its own small lie.
 */

export default async function InboxPage() {
  const [session, locale] = await Promise.all([resolveSession(), getLocale()]);
  const dictionary = getDictionary(locale);
  const words = dictionary.experienceInbox.inbox;

  if (session.state === "signed-in") {
    /* The switch, the threads and the side are asked for together; the
       threads are only drawn when the switch is on (Track M performance). */
    const [messagingOn, conversations, side, assistantOn, tickets, prefs] = await Promise.all([
      isFeatureEnabled("messaging"),
      loadConversationSummaries(session.supabase, session.user),
      getSide(),
      /* Grade 1 (P1.4): the assistant's row is pinned first when it is on. */
      isFeatureEnabled("assistant"),
      /* Grade 1 (R70): the member's support conversations, as an inner page
         of Messages. A failed read is simply no Support chip. */
      loadMyTickets(20),
      /* Grade 1 (job 8): this reader's pins and mutes; none offered when the
         table is not there yet. */
      loadConversationPrefs(session.supabase, session.user.id),
    ]);
    if (!messagingOn) {
      return (
        <div className="mx-auto max-w-2xl">
          <div className="relative">
            <PageScene art="bot-chat" />
            <PageHeader variant="large" title={words.title} />
          </div>
          <p className="nf-panel nf-panel--card nf-body p-card sm:p-cell text-center text-[var(--nf-content-muted)]">
            {words.paused}
          </p>
        </div>
      );
    }

    /* VC1: a thread whose newest message is a call this reader missed shows
       the missed-call line. Only rows whose words look like a call marker are
       asked about, and `messages.call_id` decides, so typed words never can. */
    const maybeCalls = conversations
      .filter((c) => !c.lastFromMe && c.lastMessageId && parseCallMarker(c.lastMessage))
      .map((c) => c.lastMessageId!);
    /* Track G: which threads this reader archived or reported, and which side
       the shell is on, so the inbox opens where the reader already is. Asked
       beside the missed-call markers, not after them (speed pass, 8 October
       2026): both hang off the threads alone, so they are one round trip. */
    const [views, markers] = await Promise.all([
      loadInboxViews(
        session.supabase as unknown as SupabaseClient,
        session.user.id,
        conversations.map((c) => ({ id: c.id, counterpartId: c.counterpartId ?? "", lastAt: c.lastAt })),
      ),
      markerIds(session.supabase, maybeCalls),
    ]);
    const missedWords = { VIDEO: dictionary.calls.history.inboxMissedVideo, AUDIO: dictionary.calls.history.inboxMissedVoice };
    const rows: InboxRow[] = conversations.map((c) => {
      const missed = inboxMissedCall(c.lastMessage, c.lastFromMe, Boolean(c.lastMessageId && markers.has(c.lastMessageId)));
      return {
      ...(missed ? { missedCall: { kind: missed, words: missedWords[missed] } } : {}),
      id: c.id,
      counterpartName: c.counterpartName,
      listingTitle: c.listingTitle,
      lastMessage: c.lastMessage,
      whenLabel: c.whenLabel,
      unread: c.unread,
      isRequest: c.isRequest,
      counterpartKind: c.counterpartKind,
      counterpartVerified: c.counterpartVerified,
      counterpartTier: c.counterpartTier,
      counterpartAvatarUrl: c.counterpartAvatarUrl ?? null,
      contextKind: c.contextKind,
      side: c.side ?? "property",
      archived: views.archived.has(c.id),
      reported: views.reported.has(c.id),
      pinnedAt: prefs.byId[c.id]?.pinnedAt ?? null,
      mutedUntil: prefs.byId[c.id]?.mutedUntil ?? null,
      };
    });

    const supportRows: SupportInboxRow[] =
      tickets.state === "ok"
        ? tickets.tickets.map((ticket) => {
            const last = ticket.thread.last;
            return {
              id: ticket.id,
              title: ticket.topic ?? ticket.reference,
              reference: ticket.reference,
              preview: last ? previewLine(last.body) : ticket.reference,
              whenLabel: lagosWhenLabel(last?.createdAt ?? ticket.createdAt),
              unread: ticket.unread,
            };
          })
        : [];

    return (
      <PullToRefresh className="mx-auto max-w-(--container-2xl) lg:max-w-(--container-4xl)">
        <Inbox
          rows={rows}
          meId={session.user.id}
          canMarkRead
          initialSide={side}
          archiveOpen={views.archiveOpen}
          inboxCopy={words}
          plusCopy={dictionary.inboxPlus}
          assistantOn={assistantOn}
          supportRows={supportRows}
          prefsOpen={prefs.open}
        />
      </PullToRefresh>
    );
  }

  // -------------------------------------------------------- nobody signed in
  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative">
        <PageScene art="bot-chat" />
        <PageHeader variant="large" title={words.title} />
      </div>
      <InboxEmpty
        title={words.signedOutTitle}
        body={words.signedOutBody}
        action={{ href: withNext("/sign-in", "/messages"), label: words.signIn }}
        secondary={{ href: "/search", label: words.explore }}
      />
    </div>
  );
}
