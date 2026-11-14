"use client";

import { refreshUnreadConversations, useUnreadConversations } from "@/lib/messages/unread-live";
import { NewPill } from "@/components/ui/NewPill";
import { newSince, settleBaseline } from "@/lib/ui/small-rules";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useClientCopy } from "@/lib/i18n/client-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markInboxRead, markThreadRead } from "@/lib/messages/actions";
import { banner } from "@/lib/ui/toast";
import { highlightParts, snippetAround } from "@/components/app/messages/highlight";
import { InboxSwipe, type SwipeAction } from "@/components/app/messages/InboxSwipe";
import { muteConversation, pinConversation } from "@/lib/messages/prefs-actions";
import { isMuted, muteUntil, pinnedFirst, type ConversationPref, type MuteFor } from "@/lib/messages/conversation-prefs";
import { archiveConversation, unarchiveConversation } from "@/lib/messages/archive";
import type { Side } from "@/lib/side.constants";
import { useInboxTyping } from "@/lib/messages/useRealtime";
import { PageHeader } from "@/components/app/PageHeader";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { VerifiedAvatar } from "@/components/messages/VerifiedAvatar";
import type { Dictionary } from "@vallo/i18n/core";
import type { ThreadContextKind } from "@/lib/messages/db";
import { Segmented } from "@/components/ui/Segmented";
import { CountTabs } from "@/components/ui/CountTabs";
import { ActionSheet, type ActionSheetRow } from "@/components/ui/ActionSheet";
import { useLongPress } from "@/lib/ui/use-long-press";
import "./inbox-menu.css";
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
  /** Grade 1 (job 8): pinned to the top of this reader's inbox, and when. */
  pinnedAt?: string | null;
  /** Grade 1 (job 8): notifications muted until this instant. */
  mutedUntil?: string | null;
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
  pin: "Pin",
  unpin: "Unpin",
  pinned: "Pinned to the top",
  unpinned: "Unpinned",
  pinnedLabel: "Pinned",
  mute: "Mute",
  unmute: "Unmute",
  mutedLabel: "Muted",
  muteTitle: "Mute {name}",
  muteBody: "You will not be notified about new messages. They still arrive here.",
  mute8h: "For 8 hours",
  muteWeek: "For a week",
  muteAlways: "Until I turn it back on",
  mutedDone: "Muted. You will not be notified about this chat",
  unmutedDone: "Unmuted",
  close: "Close",
  /* The row's action sheet (handoff 6.3). */
  more: "More actions",
  menuTitle: "Actions for {name}",
  noListing: "Direct message",
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
  onMenu,
  menuOpen = false,
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
  words: { typing: string };
  /** "Online now" and "3 unread messages", already worded and counted. */
  presenceWord: string;
  unreadWord: string;
  /**
   * Opens the row's action sheet: from a long press (no control to hang a
   * popover from) or from the row's own More button, which is passed along
   * so a wide screen can hang the popover from it. Absent where the row has
   * no action to offer (signed out, or the tables are not live).
   */
  onMenu?: (row: InboxRow, from: HTMLElement | null) => void;
  /** This row's sheet is the one that is open. */
  menuOpen?: boolean;
}) {
  /* Hold the row for its actions (a phone's own long press does the same);
     a mouse keeps its right click and has the More button. */
  const press = useLongPress(() => onMenu?.(row, null), { disabled: !onMenu });
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
        data-holding={press.holding || undefined}
        className="nf-inbox-row min-w-0 flex-1"
        {...press.handlers}
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
          <span className="nf-inbox-row__when nf-numeric">
            {isMuted(row.mutedUntil) ? (
              <UiIcon name="mute" size={14} className="nf-inbox-row__mark" label={POLISH_WORDS.mutedLabel} />
            ) : null}
            {row.pinnedAt ? (
              <UiIcon name="bookmark" size={14} filled className="nf-inbox-row__mark" label={POLISH_WORDS.pinnedLabel} />
            ) : null}
            {row.whenLabel}
          </span>
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
      {onMenu && (
        <Button
          variant="icon"
          leadingIcon="more"
          onClick={(event) => onMenu(row, event.currentTarget)}
          aria-label={`${POLISH_WORDS.more}: ${row.counterpartName}`}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          title={POLISH_WORDS.more}
          data-testid="inbox-row-more"
          className="nf-inbox-more shrink-0"
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
  prefsOpen = false,
}: {
  /** Grade 1 (job 8): pin and mute are live (signed in, and the table exists). */
  prefsOpen?: boolean;
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
  /*
   * THE "NEW MESSAGES" PILL. The rows are the server's and do not move by
   * themselves; the live unread-conversations figure (the one store the rail
   * already reads, one channel, no timer) does. When it goes past the figure
   * these rows were drawn against, a conversation has a message the list does
   * not show yet: the pill says so, and a tap reads the inbox again and goes
   * to the top. The baseline follows the figure down (a thread read here or
   * elsewhere) and is taken again whenever fresh rows arrive. Compared during
   * render, so there is no frame with a stale answer. A second message in a
   * conversation that is already unread does not move the figure, so it does
   * not raise the pill.
   */
  const liveUnread = useUnreadConversations(meId !== null);
  const [baseline, setBaseline] = useState<number | null>(null);
  const [drawnRows, setDrawnRows] = useState(rows);
  if (drawnRows !== rows) {
    setDrawnRows(rows);
    setBaseline(liveUnread);
  } else {
    const settled = settleBaseline(baseline, liveUnread);
    if (settled !== baseline) setBaseline(settled);
  }
  const newConversations = newSince(baseline, liveUnread);
  const [side, setSide] = useState<Side>(initialSide);
  const [view, setView] = useState<View>("recent");
  const [, startArchiving] = useSafeTransition();
  /* Optimistic: an archived row leaves Recent the moment it is tapped. */
  const [archivedLocal, setArchivedLocal] = useState<Record<string, boolean>>({});
  /* Optimistic too: a row marked read by a swipe loses its count at once. */
  const [readLocal, setReadLocal] = useState<Record<string, true>>({});
  /* Optimistic pins and mutes, put back if the server refuses. */
  const [prefsLocal, setPrefsLocal] = useState<Record<string, ConversationPref>>({});
  /* The conversation whose mute choices are open. */
  const [muteTarget, setMuteTarget] = useState<InboxRow | null>(null);
  const [query, setQuery] = useState("");
  /* GRADE 1: search is a button in the header until it is wanted (R59). */
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /* The row whose action sheet is up, as it was when the sheet opened (every
     action closes the sheet, so a snapshot cannot go stale on screen), and
     the More button it was opened from, when it was. */
  const [rowMenu, setRowMenu] = useState<{ row: InboxRow; anchored: boolean; open: boolean } | null>(null);
  const rowMenuAnchor = useRef<HTMLElement | null>(null);
  /* The header's More button: the inbox's options hang from it on a wide screen. */
  const optionsAnchor = useRef<HTMLButtonElement | null>(null);
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
        const prefs = prefsLocal[r.id] ?? null;
        return archived || read || prefs ? { ...r, ...archived, ...read, ...prefs } : r;
      }),
    [rows, archivedLocal, readLocal, prefsLocal],
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
    /* Pinned conversations ride at the top of every view (job 8). */
    const byView = pinnedFirst(onSide.filter((r) => inView(r, view)));
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
    /* Said ON THE TAP, with Undo for an archive (Survey A, Messages; Agent
       FEEL: lib/ui/optimistic.ts); a refusal puts the row back and replaces it. */
    const said = next ? inbox.archivedNote.replace("{name}", row.counterpartName) : inbox.movedBackNote;
    if (next) {
      banner.success(said, {
        action: { label: POLISH_WORDS.undo, run: () => toggleArchive({ ...row, archived: true }) },
      });
    } else banner.success(said);
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
        router.refresh();
      } catch (error) {
        setArchivedLocal((current) => ({ ...current, [row.id]: !next }));
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* Pin and mute (job 8): optimistic, said in the banner, put back on a refusal. */
  const setPref = (
    row: InboxRow,
    next: ConversationPref,
    work: () => Promise<{ ok: true; data: ConversationPref } | { ok: false; error: string }>,
    said: string,
  ) => {
    const before: ConversationPref = { pinnedAt: row.pinnedAt ?? null, mutedUntil: row.mutedUntil ?? null };
    setPrefsLocal((current) => ({ ...current, [row.id]: next }));
    banner.success(said);
    void work()
      .then((result) => {
        if (result.ok) {
          setPrefsLocal((current) => ({ ...current, [row.id]: result.data }));
          return;
        }
        setPrefsLocal((current) => ({ ...current, [row.id]: before }));
        banner.error(result.error);
      })
      .catch((error: unknown) => {
        setPrefsLocal((current) => ({ ...current, [row.id]: before }));
        if (!tapFailedOffline(error)) throw error;
      });
  };
  const togglePin = (row: InboxRow) => {
    const pin = !row.pinnedAt;
    setPref(
      row,
      { pinnedAt: pin ? new Date().toISOString() : null, mutedUntil: row.mutedUntil ?? null },
      () => pinConversation({ conversationId: row.id, pinned: pin }),
      pin ? POLISH_WORDS.pinned : POLISH_WORDS.unpinned,
    );
  };
  const setMute = (row: InboxRow, until: MuteFor | null) => {
    setMuteTarget(null);
    setPref(
      row,
      { pinnedAt: row.pinnedAt ?? null, mutedUntil: until ? muteUntil(until) : null },
      () => muteConversation({ conversationId: row.id, until }),
      until ? POLISH_WORDS.mutedDone : POLISH_WORDS.unmutedDone,
    );
  };

  /* Swipe, Mark read: one conversation, said in the banner. */
  const markOneRead = (row: InboxRow) => {
    setReadLocal((current) => ({ ...current, [row.id]: true }));
    banner.success(POLISH_WORDS.readDone);
    void markThreadRead({ conversationId: row.id })
      .then((result) => {
        if (result.ok) {
          /* The row is already read on screen (`readLocal`); only the dock's
             figure needs the database's word. Not `router.refresh()`: that
             re-renders this whole inbox and empties the router cache, so the
             page behind it would refetch on back (Agent FEEL, item 2). */
          refreshUnreadConversations(0);
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
        setReadLocal((current) => {
          const rest = { ...current };
          delete rest[row.id];
          return rest;
        });
        if (!tapFailedOffline(error)) throw error;
      });
  };

  const markAllRead = () => {
    /* Said on the press; a refusal replaces it. */
    banner.success("Everything is marked as read");
    startMarking(async () => {
      try {
        const result = await markInboxRead();
        if (result.ok) {
          router.refresh();
          return;
        }
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
  const pinnedAssistant =
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
  const pinned =
    pinnedAssistant || (supportWaiting && view === "recent" && !query.trim()) ? (
      <>
        {pinnedAssistant}
        {supportWaiting && view === "recent" && !query.trim() ? <SupportRow row={supportWaiting} /> : null}
      </>
    ) : null;

  /* What can be done to one conversation, in one place: the swipe uncovers
     these and the action sheet lists them, so the two can never disagree.
     Each is offered only where its table is live. */
  const rowActions = (row: InboxRow): SwipeAction[] => [
    ...(canMarkRead && row.unread > 0
      ? [{ key: "read", label: POLISH_WORDS.read, icon: "check" as const, run: () => markOneRead(row) }]
      : []),
    ...(prefsOpen
      ? [
          {
            key: "pin",
            label: row.pinnedAt ? POLISH_WORDS.unpin : POLISH_WORDS.pin,
            icon: "bookmark" as const,
            run: () => togglePin(row),
          },
          {
            key: "mute",
            label: isMuted(row.mutedUntil) ? POLISH_WORDS.unmute : POLISH_WORDS.mute,
            icon: isMuted(row.mutedUntil) ? ("bell" as const) : ("mute" as const),
            run: () => (isMuted(row.mutedUntil) ? setMute(row, null) : setMuteTarget(row)),
          },
        ]
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
  ];
  const openRowMenu = (row: InboxRow, from: HTMLElement | null) => {
    rowMenuAnchor.current = from;
    setRowMenu({ row, anchored: from !== null, open: true });
  };
  /* The sheet's rows are the same actions. Mute opens the "for how long"
     sheet, so it carries the chevron; turning it back on is one press. */
  const rowMenuRows: ActionSheetRow[] = rowMenu
    ? rowActions(rowMenu.row).map((action) => ({
        id: action.key,
        label: action.label,
        icon: action.icon,
        onSelect: action.run,
        ...(action.key === "mute" && !isMuted(rowMenu.row.mutedUntil) ? { chevron: true } : {}),
        testId: `inbox-row-menu-${action.key}`,
      }))
    : [];

  const pick = (next: View) => {
    setView(next);
    setMenuOpen(false);
  };

  return (
    <div>
      {/* English only for now; the inbox dictionary has no words for the pill yet. */}
      <NewPill
        count={newConversations}
        label="New messages"
        onGo={() => {
          setBaseline(liveUnread);
          router.refresh();
        }}
        data-testid="inbox-new-pill"
      />
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
              ref={optionsAnchor}
              aria-label={plus?.more ?? inbox.title}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              data-testid="inbox-more"
              className="nf-icon-btn h-11 w-11"
              onClick={() => setMenuOpen((open) => !open)}
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
        {/* The views as the shared count tabs (handoff 6.3): one row that
            scrolls sideways, radio semantics because it filters the list
            below, the waiting counts on the tabs that have a queue. A tab
            never shrinks, so a count cannot run under its neighbour. */}
        {/* A filter appears only when it has something in it. All always
            shows; the view you are on never vanishes under you. Archived
            shows once something is archived; Reported opens from the options
            sheet and shows a tab only while it is the view. Every count is
            taken from the rows already on the screen. */}
        <CountTabs<View>
          label={tabLabels.filterLabel}
          idPrefix="inbox-view"
          value={view}
          onChange={setView}
          items={VIEW_ORDER.filter(
            (key) =>
              key === "recent" ||
              view === key ||
              (key === "support" && supportRows.length > 0) ||
              ((key === "unread" || key === "requests" || key === "archived") && onSide.some((r) => inView(r, key))),
          ).map((key) => ({
            key,
            label:
              key === "requests"
                ? tabLabels.requests
                : key === "support"
                  ? POLISH_WORDS.support
                  : key === "recent" && plus
                    ? plus.all
                    : inbox.filters[key],
            count:
              key === "unread"
                ? unreadThreads
                : key === "requests"
                  ? requests.length
                  : key === "support"
                    ? supportRows.filter((r) => r.unread).length
                    : 0,
            testId: `inbox-view-${key}`,
          }))}
        />
      </div>

      {/* Archive and move back are said in the top banner (Grade 1). */}


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
            {shown.map((row) => {
              const actions = rowActions(row);
              return (
                <Row
                  key={row.id}
                  row={row}
                  typing={typing.has(row.id)}
                  onMenu={actions.length > 0 ? openRowMenu : undefined}
                  menuOpen={rowMenu?.open === true && rowMenu.row.id === row.id}
                  presenceWord={inbox.presence.online}
                  unreadWord={plural(row.unread, inbox.unreadBadge, locale)}
                  words={{ typing: inbox.typing }}
                  query={query}
                  swipe={actions}
                />
              );
            })}
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

      {/* Job 8: how long to mute a conversation for. */}
      {/* ONE CONVERSATION'S ACTIONS (handoff 6.3): the person and what the
          conversation is about in the header card, which opens it; then the
          actions the swipe has. A long press opens it on a phone; the row's
          More button opens it for a mouse and a keyboard, as a popover hung
          from that button on a wide screen. */}
      <ActionSheet
        open={rowMenu?.open === true}
        onOpenChange={(next) => {
          if (!next) setRowMenu((current) => (current ? { ...current, open: false } : current));
        }}
        title={POLISH_WORDS.menuTitle.replace("{name}", rowMenu?.row.counterpartName ?? "")}
        anchor={rowMenu?.anchored ? rowMenuAnchor : undefined}
        testId="inbox-row-menu"
        header={
          rowMenu
            ? {
                title: rowMenu.row.counterpartName,
                subtitle: rowMenu.row.listingTitle ?? POLISH_WORDS.noListing,
                media: (
                  <VerifiedAvatar
                    name={rowMenu.row.counterpartName}
                    tier={rowMenu.row.counterpartTier}
                    kind={rowMenu.row.counterpartKind}
                    photoUrl={rowMenu.row.counterpartAvatarUrl ?? undefined}
                    size="md"
                  />
                ),
                href: `/messages/${rowMenu.row.id}`,
                testId: "inbox-row-menu-open",
              }
            : undefined
        }
        rows={rowMenuRows}
      />
      <Sheet
        open={muteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMuteTarget(null);
        }}
        title={POLISH_WORDS.muteTitle.replace("{name}", muteTarget?.counterpartName ?? "")}
        description={POLISH_WORDS.muteBody}
        closeLabel={POLISH_WORDS.close}
        detents={[0.5]}
        testId="inbox-mute"
      >
        <ul className="nf-inbox-menu">
          {(
            [
              ["8h", POLISH_WORDS.mute8h],
              ["week", POLISH_WORDS.muteWeek],
              ["always", POLISH_WORDS.muteAlways],
            ] as const
          ).map(([choice, label]) => (
            <li key={choice}>
              <button
                type="button"
                onClick={() => muteTarget && setMute(muteTarget, choice)}
                data-testid={`inbox-mute-${choice}`}
              >
                <UiIcon name="mute" size={20} />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {/* GRADE 1 (R61): the inbox's options, as one sheet. Since 14 November
          2026 it is the shared action sheet in its plainest shape (handoff
          6.3, "the more at the top of a list"): rows only, a Done bar on a
          phone, a popover hung from the header's More button on a wide
          screen. Every row is one the old sheet had. */}
      <ActionSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={plus?.menuTitle ?? inbox.title}
        anchor={optionsAnchor}
        testId="inbox-menu"
        rows={[
          ...(canMarkRead && unreadTotal > 0
            ? [
                {
                  id: "mark-read",
                  label: marking ? inbox.marking : inbox.markAllRead,
                  icon: "check" as const,
                  disabled: marking,
                  onSelect: markAllRead,
                  testId: "inbox-mark-read",
                },
              ]
            : []),
          {
            id: "unread",
            label: view === "unread" ? (plus?.showAll ?? inbox.filters.recent) : (plus?.showUnread ?? inbox.filters.unread),
            icon: "mail" as const,
            onSelect: () => pick(view === "unread" ? "recent" : "unread"),
            testId: "inbox-menu-unread",
          },
          {
            id: "requests",
            label: plus?.requests ?? tabLabels.requests,
            icon: "users" as const,
            onSelect: () => pick("requests"),
            testId: "inbox-menu-requests",
          },
          ...(archiveOpen
            ? [
                {
                  id: "archived",
                  label: plus?.archived ?? inbox.filters.archived,
                  icon: "archive" as const,
                  onSelect: () => pick("archived"),
                  testId: "inbox-menu-archived",
                },
              ]
            : []),
          {
            id: "reported",
            label: plus?.reported ?? inbox.filters.reported,
            icon: "flag" as const,
            onSelect: () => pick("reported"),
            testId: "inbox-menu-reported",
          },
          /* Starting a conversation begins from a place (Grade 1: moved here
             from the header, which keeps two round buttons). */
          { id: "compose", label: plus?.compose ?? inbox.compose, icon: "pencil" as const, href: "/search", testId: "inbox-compose" },
          /* With support conversations, they open here, in Messages (R70). */
          supportRows.length > 0
            ? {
                id: "support",
                label: plus?.support ?? inbox.title,
                icon: "headset" as const,
                onSelect: () => pick("support"),
                testId: "inbox-menu-support",
              }
            : { id: "support", label: plus?.support ?? inbox.title, icon: "headset" as const, href: "/support/messages", testId: "inbox-menu-support" },
          {
            id: "refresh",
            label: plus?.refresh ?? inbox.title,
            icon: "history" as const,
            onSelect: () => router.refresh(),
            testId: "inbox-menu-refresh",
          },
        ]}
      />
    </div>
  );
}
