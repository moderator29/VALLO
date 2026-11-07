"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useClientCopy } from "@/lib/i18n/client-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markInboxRead, markThreadRead } from "@/lib/messages/actions";
import { banner } from "@/lib/ui/toast";
import { highlightParts, snippetAround } from "@/components/app/messages/highlight";
import { InboxSwipe, type SwipeAction } from "@/components/app/messages/InboxSwipe";
import { archiveConversation, unarchiveConversation } from "@/lib/messages/archive";
import type { Side } from "@/lib/side.constants";
import { useInboxTyping } from "@/lib/messages/useRealtime";
import { PageHeader } from "@/components/app/PageHeader";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { VerifiedAvatar } from "@/components/messages/VerifiedAvatar";
import type { Dictionary } from "@vallo/i18n/core";
import type { ThreadContextKind } from "@/lib/messages/db";
import { Segmented } from "@/components/ui/Segmented";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { useInboxPart } from "@/components/app/threads/use-inbox-copy";
import { formatNumber, plural } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ICON, TYPE } from "@/components/app/Screen";
import { previewLine } from "@/components/app/messages/preview";
import { type BadgeTier } from "@/lib/trust/badge-tier";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The Inbox.
 *
 * One list component for both worlds: the signed-in reader gets real
 * conversations under RLS, the signed-out reader gets the seed threads, and
 * both are the same rows with the same states, so the surface cannot look like
 * two different products depending on who is holding it.
 *
 * Three tabs, and the middle one is the point. Requests holds a thread opened
 * by somebody the reader has never spoken to, so a stranger arrives in a
 * waiting room rather than in the main list. That is one of the platform's
 * three standing refusals about messaging, made visible.
 *
 * Typing is real: the thread view has broadcast on `typing-<id>` since
 * messaging shipped, and the rows listen on exactly those channels. Where
 * there is no Supabase connection the hook is inert and no row ever claims
 * somebody is typing.
 */

export type InboxRow = {
  id: string;
  counterpartName: string;
  listingTitle: string | null;
  lastMessage: string;
  whenLabel: string;
  unread: number;
  isRequest: boolean;
  counterpartKind: "agent" | "member";
  counterpartVerified: boolean;
  /** The counterpart's published badge, `public.person_badge.tier`. */
  counterpartTier: BadgeTier;
  /** Their photo; absent or null draws their initial on the brand tint. */
  counterpartAvatarUrl?: string | null;
  /**
   * What the thread is for. A listing thread carries no glyph, because it is
   * the ordinary case; a table or a stay carries a small one beside its
   * subject line so the inbox stays one list on both sides while a row still
   * says which kind of thing it is about. `UiIcon` tier only: a glass object
   * in a list row is exactly the thing the surface language forbids.
   */
  contextKind?: ThreadContextKind;
  /** Property or Stays (track G). Absent reads as Property. */
  side?: Side;
  /** Archived by this reader, and not answered since. */
  archived?: boolean;
  /** This reader reported the conversation, a message in it or the person. */
  reported?: boolean;
  /**
   * Whether the counterpart is on Vallo right now. Drawn as a presence dot on
   * the avatar ONLY when this is "online": there is no presence data today
   * (request W5-4), so no row carries it and no dot is ever drawn that was not
   * earned. Absent never means "offline", it means "not known".
   */
  presence?: "online";
  /**
   * VC1: the newest message is a call this reader missed (read from the
   * call marker's `call_id`, never from typed words). Drawn as a red
   * missed-call line in place of the preview.
   */
  missedCall?: { kind: "AUDIO" | "VIDEO"; words: string };
};

/* GRADE 1 (inbox polish): English only for now, beside the dictionary's words. */
const POLISH_WORDS = {
  read: "Mark read",
  readDone: "Marked as read",
  undo: "Undo",
  support: "Support",
  supportName: "Vallo Support",
  newReply: "New reply from Vallo Support",
  supportEmptyTitle: "No support conversations",
  supportEmptyBody: "Ask Vallo AI anything, and choose Talk to a person when you want the support team.",
};

/**
 * GRADE 1 (R70): a conversation with the Vallo support team, read from the
 * member's own support tickets (`loadMyTickets`, their RLS). It opens as an
 * inner page of Messages, the ticket's own thread.
 */
export type SupportInboxRow = {
  id: string;
  /** The topic in words, or the reference when there is none. */
  title: string;
  reference: string;
  /** The newest line, already one line long. */
  preview: string;
  whenLabel: string;
  unread: boolean;
};

function SupportRow({ row, query = "" }: { row: SupportInboxRow; query?: string }) {
  return (
    <li className="flex items-center gap-3xs">
      <Link
        href={`/support/messages/${row.id}`}
        className="nf-inbox-row nf-inbox-support min-w-0 flex-1"
        data-testid="inbox-support-row"
        data-unread={row.unread || undefined}
      >
        <span className="nf-inbox-pinned__tile" aria-hidden="true">
          <UiIcon name="headset" size={24} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className={`block truncate ${TYPE.rowTitle} font-semibold`}>
            {POLISH_WORDS.supportName}
          </span>
          <span className={`mt-3xs block truncate ${TYPE.caption} text-[var(--nf-content-muted)]`}>
            <Hit text={`${row.title} · ${row.reference}`} query={query} />
          </span>
          <span
            className={`nf-body-sm mt-3xs block truncate ${
              row.unread ? "font-semibold text-[var(--nf-content-primary)]" : "text-[var(--nf-content-secondary)]"
            }`}
          >
            {row.unread && !query.trim() ? POLISH_WORDS.newReply : <Hit text={row.preview} query={query} />}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-inline-tight self-stretch">
          <span className="nf-inbox-row__when nf-numeric">{row.whenLabel}</span>
          {row.unread ? <span className="nf-inbox-support__dot" aria-hidden="true" /> : <span aria-hidden="true" className="h-[1.375rem]" />}
        </span>
      </Link>
    </li>
  );
}

/** Words with the reader's search marked where it matched. */
function Hit({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.hit ? (
          <mark key={i} className="nf-inbox-hit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

const CONTEXT_GLYPH: Partial<Record<ThreadContextKind, UiIconName>> = {
  reservation: "utensils",
  booking: "building-hotel",
  business: "building-hotel",
};

/*
 * TWO AXES (track G, 25 September 2026).
 *
 * The SIDE is the product's two-sided model, Property and Stays, as the top
 * tabs: a rental enquiry and a hotel booking are different errands and each
 * side's list is short enough to scan. It opens on the side the shell is on.
 *
 * The VIEW is which of this reader's threads: Recent (everything live that is
 * not a request), Requests (a stranger's first message waits here, the
 * platform's standing refusal about messaging), Archived (put away by this
 * reader only; the other party still sees it) and Reported (threads this
 * reader reported). All and Primary were folded: Recent is Primary, and a
 * list of everything mixed requests back in, which is what Requests exists to
 * stop.
 */
type View = "recent" | "unread" | "requests" | "support" | "archived" | "reported";
const VIEW_ORDER: View[] = ["recent", "unread", "requests", "support", "archived", "reported"];
const SIDE_ORDER: Side[] = ["property", "stays"];

function inView(row: InboxRow, view: View): boolean {
  /* Support conversations are their own rows (`SupportRow`), never a thread here. */
  if (view === "support") return false;
  if (view === "reported") return row.reported === true;
  if (view === "archived") return row.archived === true;
  if (row.archived) return false;
  /* Unread is a filter over the main list: a stranger's request waits in its
     own place and is never counted into what needs answering here. */
  if (view === "unread") return !row.isRequest && row.unread > 0;
  return view === "requests" ? row.isRequest : !row.isRequest;
}

function Row({
  row,
  typing,
  onArchive,
  archivePending,
  presenceWord,
  unreadWord,
  words,
  query = "",
  swipe = [],
}: {
  row: InboxRow;
  typing: boolean;
  /** The search, so the row marks where it matched. */
  query?: string;
  /** The row's swipe actions on touch (`InboxSwipe`). */
  swipe?: SwipeAction[];
  /** The row's own words, from the inbox copy. */
  words: { typing: string; archive: string; moveBack: string };
  /** "Online now" and "3 unread messages", already worded and counted. */
  presenceWord: string;
  unreadWord: string;
  /** Absent where archiving is not open (signed out, or the table is not live). */
  onArchive?: (row: InboxRow) => void;
  archivePending?: boolean;
}) {
  const glyph = row.contextKind ? CONTEXT_GLYPH[row.contextKind] : undefined;
  /* One short line (founder, 11 October 2026): line breaks folded, cut at a
     word. A shared card previews as its words, never as the path it carries. */
  /* Searching: a match past the first line is brought into view. */
  const preview = query.trim() ? previewLine(snippetAround(row.lastMessage, query)) : previewLine(row.lastMessage);
  return (
    <li className="flex items-center gap-3xs">
      <InboxSwipe actions={swipe}>
      <Link
        href={`/messages/${row.id}`}
        data-testid="inbox-row"
        data-unread={row.unread > 0 || undefined}
        className="nf-inbox-row min-w-0 flex-1"
      >
        {/* The avatar in the thread family's lit ring, carrying the verified
            mark: one mark per person per row, where the eye lands first. */}
        <span className="nf-inbox-row__ring">
          <VerifiedAvatar
            name={row.counterpartName}
            tier={row.counterpartTier}
            kind={row.counterpartKind}
            photoUrl={row.counterpartAvatarUrl ?? undefined}
            size="md"
          />
          {row.presence === "online" ? (
            <>
              <span className="nf-inbox-row__presence" aria-hidden="true" data-testid="inbox-presence" />
              <span className="sr-only">{presenceWord}</span>
            </>
          ) : null}
        </span>

        <span className="min-w-0 flex-1 leading-tight">
          <span className={`block truncate ${TYPE.rowTitle} ${row.unread > 0 ? "font-semibold" : ""}`}>
            <Hit text={row.counterpartName} query={query} />
          </span>
          {row.listingTitle && (
            <span className={`nf-inbox-row__context mt-3xs flex items-center gap-inline-tight ${TYPE.caption}`}>
              {glyph && row.contextKind && (
                <UiIcon name={glyph} size={16} className="shrink-0" label={row.contextKind} />
              )}
              {/* Two lines, then the ellipsis, with the whole title on hover: a
                  listing title cut at one line lost the words that tell two
                  flats apart ("Luxury 2 bedroom apartm..."). */}
              <span className="min-w-0 line-clamp-2 [overflow-wrap:anywhere]" title={row.listingTitle}>
                <Hit text={row.listingTitle} query={query} />
              </span>
            </span>
          )}
          <span
            className={`nf-body-sm mt-3xs block truncate ${
              typing
                ? "font-semibold text-[var(--nf-brand-secondary)]"
                : row.unread > 0
                  ? "font-semibold text-[var(--nf-content-primary)]"
                  : "text-[var(--nf-content-secondary)]"
            }`}
          >
            {typing ? (
              words.typing
            ) : row.missedCall ? (
              <span className="inline-flex items-center gap-inline-tight text-[var(--nf-state-error)]" data-testid="inbox-missed-call">
                <UiIcon name="phone-missed" size={16} filled />
                {row.missedCall.words}
              </span>
            ) : (
              <Hit text={preview} query={query} />
            )}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-inline-tight self-stretch">
          <span className="nf-inbox-row__when nf-numeric">{row.whenLabel}</span>
          {row.unread > 0 ? (
            <span className="nf-inbox-row__count" aria-label={unreadWord}>
              {row.unread}
            </span>
          ) : (
            <span aria-hidden="true" className="h-[1.375rem]" />
          )}
        </span>
      </Link>
      </InboxSwipe>
      {onArchive && (
        <Button
          variant="icon"
          leadingIcon={row.archived ? "arrow-up" : "archive"}
          onClick={() => onArchive(row)}
          disabled={archivePending}
          aria-label={`${row.archived ? words.moveBack : words.archive}: ${row.counterpartName}`}
          title={row.archived ? words.moveBack : words.archive}
          data-testid="inbox-archive"
          className="shrink-0"
        />
      )}
    </li>
  );
}

/**
 * The one empty state this surface has, for every reason it can be empty.
 *
 * Exported because the signed-out page needs the same panel and a second copy
 * of it would drift, which this file's own history says out loud: the module
 * comment on `SocialPaused` records ten hand-written paused screens doing
 * exactly that. A second action is optional and only the signed-out case uses
 * it, because that is the only case with two genuinely different next steps.
 */
export function InboxEmpty({
  title,
  body,
  action,
  secondary,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <EmptyState
      icon="chat-duo"
      title={title}
      body={body}
      data-testid="inbox-empty"
      action={
        action && (
          <Link href={action.href} className="nf-btn nf-btn--primary nf-btn--md">
            {action.label}
          </Link>
        )
      }
      secondary={
        secondary && (
          <Link href={secondary.href} className="nf-btn nf-btn--ghost nf-btn--md">
            {secondary.label}
          </Link>
        )
      }
    />
  );
}

/** The local name, so the four call sites below read as they did. */
const Empty = InboxEmpty;

export function Inbox({
  rows,
  meId = null,
  canMarkRead = false,
  labels,
  initialSide = "property",
  archiveOpen = false,
  inboxCopy,
  plusCopy,
  assistantOn = false,
  supportRows = [],
}: {
  rows: InboxRow[];
  /** Grade 1 (R70): the member's support conversations, newest first. Empty draws no Support chip. */
  supportRows?: SupportInboxRow[];
  /**
   * The inbox's words (`experienceInbox.inbox`) from the server page, so this
   * client component never reads a client dictionary (that read shipped the
   * whole `@vallo/i18n` index, 398KB gzipped, on /messages).
   */
  inboxCopy?: Dictionary["experienceInbox"]["inbox"];
  /** The side the app shell is on, which the inbox opens on. */
  initialSide?: Side;
  /** Archive and unarchive are live (signed in, and the table exists). */
  archiveOpen?: boolean;
  /** The three tab words, where a server parent already holds the dictionary. */
  labels?: Dictionary["uiCommon"]["inbox"];
  /** The signed-in user, for ignoring our own typing pings. Null when seeded. */
  meId?: string | null;
  /** Only a signed-in reader has read state the server can clear. */
  canMarkRead?: boolean;
  /** Grade 1: the pinned assistant row, search and options words (`inboxPlus`). */
  plusCopy?: Dictionary["inboxPlus"];
  /** Grade 1: the assistant is switched on, so its row is pinned first. */
  assistantOn?: boolean;
}) {
  const router = useRouter();
  const [side, setSide] = useState<Side>(initialSide);
  const [view, setView] = useState<View>("recent");
  const [archiving, startArchiving] = useSafeTransition();
  /* Optimistic: an archived row leaves Recent the moment it is tapped. */
  const [archivedLocal, setArchivedLocal] = useState<Record<string, boolean>>({});
  /* Optimistic too: a row marked read by a swipe loses its count at once. */
  const [readLocal, setReadLocal] = useState<Record<string, true>>({});
  const [query, setQuery] = useState("");
  /* GRADE 1: search is a button in the header until it is wanted (R59). */
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [marking, startMarking] = useSafeTransition();

  /*
   * The dictionary is read here rather than passed, which is the LAST RESORT
   * the hook's own file describes and it qualifies on all three tests: this is
   * a `"use client"` control, its only server parent holds no dictionary
   * today, and the strings it needs are three tab labels. A caller that
   * acquires a `t` can still beat it by passing `tabLabels`.
   */
  const clientInbox = useClientCopy().uiCommon.inbox;
  const tabLabels = labels ?? clientInbox;
  const inbox = useInboxPart("inbox", inboxCopy);
  const locale = useClientLocale();

  const typing = useInboxTyping(
    rows.map((r) => r.id),
    meId,
  );

  const live = useMemo(
    () =>
      rows.map((r) => {
        const archived = r.id in archivedLocal ? { archived: archivedLocal[r.id] } : null;
        const read = readLocal[r.id] ? { unread: 0 } : null;
        return archived || read ? { ...r, ...archived, ...read } : r;
      }),
    [rows, archivedLocal, readLocal],
  );
  /* A chat with a person (9 October 2026) belongs to neither side: it shows
     on both, so a message from somebody never hides behind the other tab. */
  /* GRADE 1: the Property and Stays tabs only appear when there are
     conversations on BOTH sides; with one side, every thread is shown and
     the tab row is not drawn (one control layer fewer, R59). */
  const bothSides = useMemo(
    () =>
      live.some((r) => r.contextKind !== "direct" && r.side === "stays") &&
      live.some((r) => r.contextKind !== "direct" && (r.side ?? "property") === "property"),
    [live],
  );
  const onSide = useMemo(
    () => (bothSides ? live.filter((r) => r.contextKind === "direct" || (r.side ?? "property") === side) : live),
    [live, side, bothSides],
  );
  const requests = useMemo(() => onSide.filter((r) => inView(r, "requests")), [onSide]);
  const unreadTotal = rows.reduce((sum, r) => sum + r.unread, 0);
  /* How many CONVERSATIONS on this side wait on a reply, for the Unread chip. */
  const unreadThreads = useMemo(() => onSide.filter((r) => inView(r, "unread")).length, [onSide]);
  const unreadBySide = useMemo(() => {
    const out: Record<Side, number> = { property: 0, stays: 0 };
    for (const r of live) {
      if (r.archived || r.unread === 0) continue;
      if (r.contextKind === "direct") {
        out.property += 1;
        out.stays += 1;
      } else out[r.side ?? "property"] += 1;
    }
    return out;
  }, [live]);

  const shown = useMemo(() => {
    const byView = onSide.filter((r) => inView(r, view));
    const q = query.trim().toLowerCase();
    if (q.length === 0) return byView;
    return byView.filter((r) =>
      `${r.counterpartName} ${r.listingTitle ?? ""} ${r.lastMessage}`
        .toLowerCase()
        .includes(q),
    );
  }, [view, query, onSide]);

  const toggleArchive = (row: InboxRow) => {
    const next = !row.archived;
    setArchivedLocal((current) => ({ ...current, [row.id]: next }));
    startArchiving(async () => {
      try {
        const result = next
          ? await archiveConversation({ conversationId: row.id })
          : await unarchiveConversation({ conversationId: row.id });
        if (!result.ok) {
          setArchivedLocal((current) => ({ ...current, [row.id]: !next }));
          /* GRADE 1: every outcome in the top banner, with Try again. */
          banner.error(result.error, { retry: () => toggleArchive(row) });
          return;
        }
        /* The banner says it, with Undo for an archive (Survey A, Messages). */
        const said = next ? inbox.archivedNote.replace("{name}", row.counterpartName) : inbox.movedBackNote;
        if (next) {
          banner.success(said, {
            action: { label: POLISH_WORDS.undo, run: () => toggleArchive({ ...row, archived: true }) },
          });
        } else banner.success(said);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* Swipe, Mark read: one conversation, said in the banner. */
  const markOneRead = (row: InboxRow) => {
    setReadLocal((current) => ({ ...current, [row.id]: true }));
    void markThreadRead({ conversationId: row.id })
      .then((result) => {
        if (result.ok) {
          banner.success(POLISH_WORDS.readDone);
          router.refresh();
          return;
        }
        setReadLocal((current) => {
          const rest = { ...current };
          delete rest[row.id];
          return rest;
        });
        banner.error(result.error, { retry: () => markOneRead(row) });
      })
      .catch((error: unknown) => {
        if (!tapFailedOffline(error)) throw error;
      });
  };

  const markAllRead = () => {
    setMarkError(null);
    startMarking(async () => {
      try {
        const result = await markInboxRead();
        if (result.ok) {
          router.refresh();
          return;
        }
        setMarkError(result.error);
        banner.error(result.error, { retry: markAllRead });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* GRADE 1 (P1.4, R59): Vallo Assistant, pinned first in every inbox, even
     an empty one. It opens the assistant chat, where "Talk to a person"
     reaches the support team. Only on the main view with no search. */
  const plus = plusCopy;
  /* Support conversations, searched like any row. */
  const supportShown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return supportRows;
    return supportRows.filter((r) => `${r.title} ${r.reference} ${r.preview}`.toLowerCase().includes(q));
  }, [supportRows, query]);
  /* A reply from the support team waiting to be read rides under the
     assistant at the top of the main view, so it is never missed. */
  const supportWaiting = supportRows.find((r) => r.unread) ?? null;
  const pinned =
    assistantOn && plus && view === "recent" && !query.trim() ? (
      <li className="flex items-center gap-3xs">
        <Link href="/assistant" className="nf-inbox-row nf-inbox-pinned min-w-0 flex-1" data-testid="inbox-assistant">
          <span className="nf-inbox-pinned__tile" aria-hidden="true">
            <UiIcon name="bot" size={24} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className={`block truncate ${TYPE.rowTitle} font-semibold`}>{plus.assistantName}</span>
            <span className="nf-body-sm mt-3xs block truncate text-[var(--nf-content-secondary)]">{plus.assistantLine}</span>
          </span>
        </Link>
      </li>
    ) : null;

  const pick = (next: View) => {
    setView(next);
    setMenuOpen(false);
  };

  return (
    <div>
      {/* ------------------------------------------------------- heading */}
      {/* The back control belongs to the page, per the platform's header
          contract, and the compose button rides the same row on the right. */}
      {/*
        THE COMPOSE CONTROL WENT NOWHERE. It linked to `/messages/new`, and that
        route's first line is `if (!listing) redirect("/messages")` - so the
        button bounced straight back to the screen it was pressed on. A control
        that does nothing is worse than no control, and this one advertised a
        capability the product does not have.

        It is not removed, it is pointed at the truth. Every conversation on
        Vallo starts from a property, because the thread is with the agent
        FOR that property; there is no freeform compose and there should not
        be one. So the control now goes where a person would actually start a
        new conversation, and its label says so.
      */}
      {/*
        MARK ALL READ MOVED INTO THE HEADER, AND A ROW LEAVES THE SCREEN.

        This screen stacked four control surfaces between the title and the
        first conversation: the header, a search field, three tabs, and then a
        right-aligned row holding one ghost button. That last one was a whole
        row of vertical space, on a phone, for a control most people press once
        a week, and it appeared and disappeared as the unread count crossed
        zero, so the list below it jumped by 40px whenever somebody read their
        last message.

        It is a header action now, beside the one that starts a conversation,
        which is where a screen-level action belongs. Nothing is hidden: it
        still carries its own count and it still only renders when there is
        something to mark, but it no longer moves the list when it goes.
      */}
      <PageHeader
        variant="large"
        title={inbox.title}
        {...(unreadTotal > 0 ? { subtitle: inbox.unreadCount.replace("{count}", formatNumber(unreadTotal, locale)) } : {})}
        actions={
          <div className="flex shrink-0 items-center gap-inline">
            {/* GRADE 1 (R59): search and the options sheet as two round
                buttons beside the title; Mark all read lives in the sheet. */}
            <button
              type="button"
              aria-label={searchOpen ? (plus?.closeSearch ?? inbox.clearSearch) : (plus?.openSearch ?? inbox.search)}
              aria-expanded={searchOpen}
              data-testid="inbox-search-toggle"
              className="nf-icon-btn h-11 w-11"
              onClick={() => {
                if (searchOpen) setQuery("");
                setSearchOpen((open) => !open);
              }}
            >
              <UiIcon name={searchOpen ? "close" : "search"} size={ICON.row} />
            </button>
            <button
              type="button"
              aria-label={plus?.more ?? inbox.title}
              data-testid="inbox-more"
              className="nf-icon-btn h-11 w-11"
              onClick={() => setMenuOpen(true)}
            >
              <UiIcon name="more" size={ICON.row} />
            </button>
          </div>
        }
      />

      {/* -------------------------------------------------------- search */}
      {/* The clear affordance is the whole reason this is the primitive: a
          search that filters as you type needs a way back to everything that
          is not "select all and delete", and the platform's other four search
          bars each hand-rolled the icon slot at a different size. */}
      {searchOpen || query ? (
      <TextField
        label={inbox.search}
        hideLabel
        autoFocus
        type="search"
        leadingIcon="search"
        clearable={inbox.clearSearch}
        onClear={() => setQuery("")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={inbox.searchPlaceholder}
        data-testid="inbox-search"
      />
      ) : null}

      {/* ------------------------------------------------ side, then view */}
      {/*
        The SIDE is a real tablist (it swaps the whole list), opening on the
        side the shell is on, each tab carrying how many of its threads are
        unread. The VIEW is a radiogroup of chips beneath it: a filter over
        that side's list, four equal cells so every word is whole at 390px.
      */}
      {bothSides ? (
      <div className="mt-heading">
        <Segmented<Side>
          label={inbox.sides}
          full
          options={SIDE_ORDER.map((key) => ({
            value: key,
            label: key === "stays" ? inbox.sideStays : inbox.sideProperty,
            ...(unreadBySide[key] > 0 ? { count: unreadBySide[key] } : null),
          }))}
          value={side}
          onChange={setSide}
          itemIdPrefix="inbox-side"
        />
      </div>
      ) : null}
      <div className="mt-sm" data-testid="inbox-views">
        {/* The views as filter chips (north star 15.4): one rail, radio
            semantics because it filters the list below, the waiting counts
            on the two chips that have a queue. Chips have room for a count
            where the old segmented track cut the word. */}
        <ChipRow label={tabLabels.filterLabel} radiogroup bleed={false}>
          {/* A filter appears only when it has something in it. Recent and
              Requests always show; the view you are on never vanishes under you. */}
          {/* GRADE 1 (R59): All, Unread and Requests as the one chip row;
              Archived and Reported open from the options sheet and show a
              chip only while they are the view. */}
          {VIEW_ORDER.filter(
            (key) =>
              key === "recent" ||
              view === key ||
              (key === "support" && supportRows.length > 0) ||
              ((key === "unread" || key === "requests") && onSide.some((r) => inView(r, key))),
          ).map((key) => {
            const count =
              key === "unread"
                ? unreadThreads
                : key === "requests"
                  ? requests.length
                  : key === "support"
                    ? supportRows.filter((r) => r.unread).length
                    : 0;
            return (
              <Chip
                key={key}
                behaviour="choice"
                size="md"
                selected={view === key}
                onSelectedChange={() => setView(key)}
                {...(count > 0 ? { count } : {})}
                data-testid={`inbox-view-${key}`}
              >
                {key === "requests"
                  ? tabLabels.requests
                  : key === "support"
                    ? POLISH_WORDS.support
                    : key === "recent" && plus
                      ? plus.all
                      : inbox.filters[key]}
              </Chip>
            );
          })}
        </ChipRow>
      </div>

      {/* Archive and move back are said in the top banner (Grade 1). */}

      {markError && (
        /* Rose, not cyan: `--nf-state-warning` is the pending token under
           another name, and a write that did not happen is not in flight. */
        <p role="alert" className="nf-body-sm mt-inline text-[var(--nf-state-error)]">
          {markError}
        </p>
      )}

      {/* ---------------------------------------------------------- list */}
      {/* The panel the tabs above actually control. It is keyed on the tab so
          the list re-enters rather than mutating in place, and it names its own
          tab, which is what makes the tablist a tablist. */}
      <div
        key={`${side}-${view}`}
        role="tabpanel"
        id={`inbox-panel-${side}`}
        aria-labelledby={`inbox-side-${side}`}
        className="mt-heading"
      >
        {view === "support" ? (
          supportShown.length > 0 ? (
            <ul className="nf-inbox-list">
              {supportShown.map((row) => (
                <SupportRow key={row.id} row={row} query={query} />
              ))}
            </ul>
          ) : (
            <Empty
              title={query.trim() ? inbox.noMatchTitle : POLISH_WORDS.supportEmptyTitle}
              body={query.trim() ? inbox.noMatchBody.replace("{query}", query.trim()) : POLISH_WORDS.supportEmptyBody}
            />
          )
        ) : null}
        {view !== "support" && shown.length === 0 && pinned ? <ul className="nf-inbox-list">{pinned}</ul> : null}
        {view === "support" ? null : shown.length > 0 ? (
          /* Hairline rows on the ground, not a card wrapping a divided list.
             One line between two conversations, nothing around either. */
          <ul className="nf-inbox-list">
            {pinned}
            {shown.map((row) => (
              <Row
                key={row.id}
                row={row}
                typing={typing.has(row.id)}
                onArchive={archiveOpen && view !== "reported" ? toggleArchive : undefined}
                archivePending={archiving}
                presenceWord={inbox.presence.online}
                unreadWord={plural(row.unread, inbox.unreadBadge, locale)}
                words={{ typing: inbox.typing, archive: inbox.archive, moveBack: inbox.moveBack }}
                query={query}
                swipe={[
                  ...(canMarkRead && row.unread > 0
                    ? [{ key: "read", label: POLISH_WORDS.read, icon: "check" as const, run: () => markOneRead(row) }]
                    : []),
                  ...(archiveOpen && view !== "reported"
                    ? [
                        {
                          key: "archive",
                          label: row.archived ? inbox.moveBack : inbox.archive,
                          icon: row.archived ? ("arrow-up" as const) : ("archive" as const),
                          tone: "brand" as const,
                          run: () => toggleArchive(row),
                        },
                      ]
                    : []),
                ]}
              />
            ))}
          </ul>
        ) : query.trim().length > 0 ? (
          <Empty
            title={inbox.noMatchTitle}
            body={inbox.noMatchBody.replace("{query}", query.trim())}
          />
        ) : view === "unread" ? (
          <Empty
            title={inbox.emptyUnread.title}
            body={inbox.emptyUnread.body}
          />
        ) : view === "requests" ? (
          <Empty
            title={inbox.noRequestsTitle}
            body={inbox.noRequestsBody}
          />
        ) : view === "archived" ? (
          <Empty
            title={archiveOpen ? inbox.noArchivedTitle : inbox.archiveClosedTitle}
            body={archiveOpen ? inbox.noArchivedBody : inbox.archiveClosedBody}
          />
        ) : view === "reported" ? (
          <Empty
            title={inbox.noReportedTitle}
            body={inbox.noReportedBody}
          />
        ) : onSide.length === 0 ? (
          side === "stays" ? (
            <Empty
              title={inbox.noStaysTitle}
              body={inbox.noStaysBody}
              action={{ href: "/stays", label: inbox.findStay }}
            />
          ) : (
            <Empty
              title={inbox.noneTitle}
              body={inbox.noneBody}
              action={{ href: "/search", label: inbox.findPlace }}
            />
          )
        ) : (
          <Empty
            title={inbox.recentEmptyTitle}
            body={inbox.recentEmptyBody}
          />
        )}
      </div>

      {/* GRADE 1 (R61): the inbox's options, as one sheet. */}
      <Sheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={plus?.menuTitle ?? inbox.title}
        closeLabel={inbox.clearSearch}
        detents={[0.5]}
        testId="inbox-menu"
      >
        <ul className="nf-inbox-menu">
          {canMarkRead && unreadTotal > 0 ? (
            <li>
              <button type="button" onClick={() => { markAllRead(); setMenuOpen(false); }} disabled={marking} data-testid="inbox-mark-read">
                <UiIcon name="check" size={20} />
                {marking ? inbox.marking : inbox.markAllRead}
              </button>
            </li>
          ) : null}
          <li>
            <button type="button" onClick={() => pick(view === "unread" ? "recent" : "unread")}>
              <UiIcon name="mail" size={20} />
              {view === "unread" ? (plus?.showAll ?? inbox.filters.recent) : (plus?.showUnread ?? inbox.filters.unread)}
            </button>
          </li>
          <li>
            <button type="button" onClick={() => pick("requests")}>
              <UiIcon name="users" size={20} />
              {plus?.requests ?? tabLabels.requests}
            </button>
          </li>
          {archiveOpen ? (
            <li>
              <button type="button" onClick={() => pick("archived")} data-testid="inbox-menu-archived">
                <UiIcon name="archive" size={20} />
                {plus?.archived ?? inbox.filters.archived}
              </button>
            </li>
          ) : null}
          <li>
            <button type="button" onClick={() => pick("reported")}>
              <UiIcon name="flag" size={20} />
              {plus?.reported ?? inbox.filters.reported}
            </button>
          </li>
          <li>
            {/* Starting a conversation begins from a place (Grade 1: moved
                here from the header, which keeps two round buttons). */}
            <Link href="/search" onClick={() => setMenuOpen(false)} data-testid="inbox-compose">
              <UiIcon name="pencil" size={20} />
              {plus?.compose ?? inbox.compose}
            </Link>
          </li>
          <li>
            <Link href="/support/messages" onClick={() => setMenuOpen(false)}>
              <UiIcon name="headset" size={20} />
              {plus?.support ?? inbox.title}
            </Link>
          </li>
          <li>
            <button type="button" onClick={() => { router.refresh(); setMenuOpen(false); }}>
              <UiIcon name="history" size={20} />
              {plus?.refresh ?? inbox.title}
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}
