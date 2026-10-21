"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./notifications.css";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { formatMoney, intlTag, plural } from "@vallo/i18n/core";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/Screen";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { ListGroup } from "@/components/ui/ListGroup";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { markNotificationsRead } from "@/lib/messages/notifications-actions";
import { loadOlderNotifications } from "@/lib/notify/inbox-actions";
import { toNotificationItem, type NotificationItem } from "@/lib/notify/links";
import { lagosTimeLabel } from "@/lib/messages/time";
import { useNotificationsRealtime, type LiveNotificationRow } from "@/lib/messages/useRealtime";
import type { SeverityVerb, SeverityVerdict } from "@/lib/notify/severity";
import { sectionRows } from "@/lib/notify/sections";
import { dayHeading, dayKeyOf } from "@/components/app/threads/day";
import { fill } from "@/components/app/threads/when";
import { useInboxLocale, useInboxPart } from "@/components/app/threads/use-inbox-copy";
import {
  FAMILY_GLYPH,
  FAMILY_ORDER,
  FAMILY_TONE,
  familyOf,
  figureIn,
  groupByObject,
  type NotificationFamily,
} from "./family";

/**
 * The notification centre (north star 16.3 and 16.4).
 *
 * Server-loaded rows with realtime prepend for new arrivals. Reads are
 * optimistic: tapping a row or mark-all flips the local state instantly and
 * the action persists it; the read_at column grant means that is the only
 * field a client can ever change. A dropped socket costs nothing; the next
 * visit renders the database's truth.
 *
 * WHAT CHANGED, AND WHAT DID NOT. The sections are the founder's own B11
 * order and stay: Needs you, New, then everything earlier. Earlier now breaks
 * by DAY (a divider per Lagos day) instead of one long list, because "what did
 * I deal with on Tuesday" is the question that section answers. New in this
 * pass:
 *
 *   FILTER CHIPS. All, Money, Trust, Spaces, Messages, Account. The family is
 *   read from the row (`family.ts`), because the row carries no family of its
 *   own yet; each chip carries how many of ITS rows are unread.
 *
 *   A ROW YOU CAN ACT ON WITHOUT OPENING IT. The title and the body are the
 *   sentence the database trigger wrote about the event, so they are shown
 *   whole (two lines), with the one naira figure the words state pulled out
 *   beside them in tabular figures, and the one verb ("Reply", "Review") as a
 *   button on the rows that need you.
 *
 *   A FULL VIEW. A row opens `/notifications/[id]`, a designed screen per
 *   family, so back behaves and a deep link lands. A message row goes
 *   straight to its conversation, because the conversation is its own full
 *   view and a detour would only slow a reply.
 *
 *   FOLDING BY RECORD. Several events on one booking, one conversation or one
 *   post are one row that expands, for every family, not only messages.
 *
 *   UNREAD IS CYAN. A count and the unread mark use the platform's count
 *   colour, never red (the north star, 6.1). Unread is also said by weight and
 *   by a visually hidden word, so colour is never the only signal.
 */

export type { NotificationItem };

type Copy = Dictionary["experienceInbox"]["notifications"];

type Entry = { row: NotificationItem; verdict: SeverityVerdict };

/** Where a row goes when it is tapped: its conversation, else its full view. */
function rowHref(n: NotificationItem, family: NotificationFamily): string {
  if (family === "messages" && n.href) return n.href;
  return `/notifications/${n.id}`;
}

export function LiveNotifications({
  initial,
  initialMore = false,
  userId,
  openThreads = [],
  now = 0,
  copy: providedCopy,
  locale: providedLocale,
}: {
  initial: NotificationItem[];
  /** True when the server read stopped at a page and older rows exist. */
  initialMore?: boolean;
  userId: string;
  /** B11: conversations that still hold an unread message for this person. */
  openThreads?: string[];
  /** The server's clock at render, so the 14-day window and "Today" agree on
      hydration. Without it (a harness) no row ages out of "Needs you" and
      every day divider is a plain date. */
  now?: number;
  /** The words, from a server parent that holds the dictionary. */
  copy?: Copy;
  locale?: Locale;
}) {
  const router = useRouter();
  /* The page passes its words; only a harness falls back (use-inbox-copy.ts). */
  const c: Copy = useInboxPart("notifications", providedCopy);
  const locale = useInboxLocale(providedLocale);
  const [items, setItems] = useState<NotificationItem[]>(initial);
  const [more, setMore] = useState(initialMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [family, setFamily] = useState<NotificationFamily | "all">("all");

  useNotificationsRealtime(userId, (row: LiveNotificationRow) => {
    setItems((prev) => {
      if (prev.some((n) => n.id === row.id)) return prev;
      return [toNotificationItem(row), ...prev];
    });
  });

  /*
   * Reads are optimistic, and a read that did not persist is put back.
   * Without the revert, a failed write left the row looking read on this
   * screen while the bell (a server count) went on counting it, and the two
   * disagreed until the next visit. On success the route is refreshed, which
   * re-renders the shell's server-side unread count, so the bell and this
   * list agree at once rather than on the next navigation.
   */
  const markOne = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      void markNotificationsRead({ ids: [id] }).then((result) => {
        if (result.ok) {
          router.refresh();
          return;
        }
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
      });
    },
    [router],
  );

  const markAll = useCallback(() => {
    const before = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setProblem(null);
    void markNotificationsRead({}).then((result) => {
      if (result.ok) {
        router.refresh();
        return;
      }
      /* Only the rows this press marked go back; anything that arrived
         over realtime in the meantime keeps its own state. */
      const unread = new Set(before.filter((n) => !n.read).map((n) => n.id));
      setItems((prev) => prev.map((n) => (unread.has(n.id) ? { ...n, read: false } : n)));
      setProblem(result.error);
    });
  }, [items, router]);

  /* Older rows, a page at a time, after the last row on screen. */
  const showOlder = useCallback(() => {
    const last = items.at(-1);
    if (!last || loadingOlder) return;
    setLoadingOlder(true);
    setProblem(null);
    /* A request that never reached the server (a dropped connection) ends the
       wait and says so, like a refused read does. */
    void loadOlderNotifications({ createdAt: last.createdAt, id: last.id })
      .then((result) => {
        setLoadingOlder(false);
        if (!result.ok) {
          setProblem(result.error);
          return;
        }
        setItems((prev) => {
          const seen = new Set(prev.map((n) => n.id));
          return [...prev, ...result.data.rows.map(toNotificationItem).filter((n) => !seen.has(n.id))];
        });
        setMore(result.data.more);
      })
      .catch(() => {
        setLoadingOlder(false);
        setProblem(c.olderFailed);
      });
  }, [items, loadingOlder, c.olderFailed]);

  const unreadCount = items.filter((n) => !n.read).length;

  /* Unread per family, for the chips. */
  const unreadBy = useMemo(() => {
    const out: Record<NotificationFamily, number> = { money: 0, trust: 0, spaces: 0, messages: 0, account: 0 };
    for (const n of items) if (!n.read) out[familyOf(n)] += 1;
    return out;
  }, [items]);

  const shown = useMemo(
    () => (family === "all" ? items : items.filter((n) => familyOf(n) === family)),
    [items, family],
  );

  const header = (
    <PageHeader
      variant="large"
      title={c.title}
      subtitle={unreadCount > 0 ? fill(c.unread, { count: unreadCount }) : undefined}
      actions={
        <div className="nf-notif__tools">
          {unreadCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAll} data-testid="notifications-mark-all">
              {c.markAllRead}
            </Button>
          ) : null}
          {/* Per-family preferences, one tap from here (north star 16.4): the
              existing settings route, where the channels are chosen. */}
          <Link
            href="/settings/notifications"
            aria-label={c.preferencesLabel}
            title={c.preferences}
            className="nf-icon-btn h-11 w-11"
            data-testid="notifications-preferences"
          >
            <UiIcon name="settings-gear" size={20} />
          </Link>
        </div>
      }
    />
  );

  if (items.length === 0) {
    return (
      <div>
        {header}
        {/* ALL CAUGHT UP, drawn as the founder's reference 1: the stack of
            notifications in depth, empty, with one warm glow behind the bell;
            a confident title, one muted line, then the one way onward and
            the quiet way to choose what arrives here. The cards are shapes,
            never invented notices. */}
        <div className="nf-notif-quiet" data-testid="notifications-empty">
          <div className="nf-notif-quiet__stack" aria-hidden="true">
            <span className="nf-notif-quiet__card nf-notif-quiet__card--3" />
            <span className="nf-notif-quiet__card nf-notif-quiet__card--2" />
            <span className="nf-notif-quiet__card nf-notif-quiet__card--1">
              <span className="nf-notif-quiet__plate">
                <UiIcon name="bell" size={20} />
              </span>
              <span className="nf-notif-quiet__lines">
                <span className="nf-notif-quiet__line" />
                <span className="nf-notif-quiet__line nf-notif-quiet__line--short" />
              </span>
            </span>
          </div>
          <h2 className="nf-notif-quiet__title">{c.empty.title}</h2>
          <p className="nf-notif-quiet__body">{c.empty.body}</p>
          <div className="nf-notif-quiet__actions">
            <ButtonLink href="/search" variant="primary" full>
              {c.empty.action}
            </ButtonLink>
            <Link href="/settings/notifications" className="nf-notif-quiet__link">
              {c.preferencesLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /*
   * B11: NEEDS YOU, THEN NEW, THEN EARLIER BY DAY (lib/notify/sections.ts).
   * "Needs you" holds the action rows that are still open, each with its one
   * verb inline; a row leaves it when its record is done where the record can
   * say so (a conversation with nothing unread), otherwise when it is opened.
   */
  const sectioned = sectionRows(shown, new Set(openThreads), now);
  const nowMs = now > 0 ? now : undefined;
  const days = splitByDay(sectioned.earlier, (e) => e.row.createdAt);

  const chips = (
    <ChipRow label={c.filterLabel} radiogroup className="nf-notif__chips">
      {(["all", ...FAMILY_ORDER] as const).map((key) => (
        <Chip
          key={key}
          behaviour="choice"
          size="md"
          selected={family === key}
          onSelectedChange={() => setFamily(key)}
          {...(key !== "all" && unreadBy[key] > 0 ? { count: unreadBy[key] } : {})}
          data-testid={`notifications-filter-${key}`}
        >
          {c.families[key]}
        </Chip>
      ))}
    </ChipRow>
  );

  return (
    <div>
      {header}
      {chips}

      {shown.length === 0 ? (
        <EmptyState
          icon="bell-badge"
          title={fill(c.emptyFamily.title, { family: c.families[family] })}
          body={c.emptyFamily.body}
          action={
            <Button variant="secondary" onClick={() => setFamily("all")}>
              {c.emptyFamily.action}
            </Button>
          }
          data-testid="notifications-empty-family"
        />
      ) : (
        <div className="nf-notif">
          <Section id="needs" label={c.sections.needsYou} entries={sectioned.needsYou} c={c} locale={locale} markOne={markOne} needs />
          <Section id="new" label={c.sections.fresh} entries={sectioned.fresh} c={c} locale={locale} markOne={markOne} />
          {days.map((day) => (
            <Section
              key={day.key}
              id={`day-${day.key}`}
              label={dayHeading(day.rows[0]!.row.createdAt, locale, c.day, nowMs)}
              entries={day.rows}
              c={c}
              locale={locale}
              markOne={markOne}
            />
          ))}
        </div>
      )}

      {problem && (
        <p role="alert" className="nf-notif__problem" data-testid="notifications-problem">
          {problem}
        </p>
      )}

      {more && (
        <div className="nf-notif__more">
          <Button variant="ghost" size="sm" onClick={showOlder} disabled={loadingOlder} data-testid="notifications-older">
            {loadingOlder ? c.loadingOlder : c.showOlder}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Consecutive rows of one Lagos day, in order. */
function splitByDay<T>(rows: readonly T[], at: (row: T) => string): { key: string; rows: T[] }[] {
  const out: { key: string; rows: T[] }[] = [];
  for (const row of rows) {
    const key = dayKeyOf(at(row)) ?? "unknown";
    const last = out.at(-1);
    if (last && last.key === key) last.rows.push(row);
    else out.push({ key, rows: [row] });
  }
  return out;
}

/* ------------------------------------------------------------------ section */

function Section({
  id,
  label,
  entries,
  c,
  locale,
  markOne,
  needs = false,
}: {
  id: string;
  label: string;
  entries: Entry[];
  c: Copy;
  locale: Locale;
  markOne(id: string): void;
  needs?: boolean;
}) {
  /* THE DEPTH STACK (the founder's reference 1, 7 October): "Needs you" is
     drawn as cards stacked in depth, the front one whole and frosted, each
     one behind it narrower, dimmer and lower, so the stack reads as real
     depth rather than a list. One tap fans it open into the list. Rows behind
     the front card are `inert` while stacked, so a keyboard or a screen
     reader meets the front card, then the control that opens the rest. */
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  /* THE CYAN BADGE COUNTS UNREAD, and only unread (north star 15.4: cyan
     unread counts). It counted every row, so a day whose two notices were both
     read said "2" in the unread colour, under an English label. It now draws
     the unread count with the dictionary's "{count} unread", and nothing at
     all when the group is read (Round 3 sweep, C5's finding). */
  const unread = entries.filter((e) => !e.row.read).length;
  const verdicts = new Map(entries.map((e) => [e.row.id, e.verdict]));
  const groups = groupByObject(entries.map((e) => e.row));
  const stacked = needs && groups.length > 1 && !open;
  const badge =
    unread > 0 ? (
      <span
        className="nf-count-badge nf-numeric nf-notif__count"
        aria-label={c.unread.replace("{count}", new Intl.NumberFormat(intlTag[locale]).format(unread))}
        data-testid={`notifications-${id}-unread`}
      >
        {unread}
      </span>
    ) : null;
  const fan =
    needs && groups.length > 1 ? (
      <button
        type="button"
        className="nf-notif__fan"
        aria-expanded={open}
        aria-label={c.emptyFamily.action}
        onClick={() => setOpen((v) => !v)}
        data-testid="notifications-needs-fan"
      >
        <UiIcon name="chevron-down" size={16} />
      </button>
    ) : null;
  return (
    /* ONE GROUPED LIST per section, rows on inset hairlines inside a single
       card. A day is its own list, so the divider is the label above it. */
    <ListGroup
      aria-label={label}
      label={label}
      labelAs="h2"
      action={
        badge || fan ? (
          <span className="nf-notif__section-tools">
            {badge}
            {fan}
          </span>
        ) : undefined
      }
      className={`nf-notif__group${needs ? " nf-notif__group--needs nf-notif__group--stack" : ""}`}
      data-stacked={needs ? (stacked ? "true" : "false") : undefined}
      data-testid={`notifications-${id}`}
    >
      {groups.map((g, i) =>
        g.rows.length > 1 ? (
          <GroupRow key={g.key} rows={g.rows} c={c} locale={locale} markOne={markOne} behind={stacked && i > 0} />
        ) : needs ? (
          <NeedsRow
            key={g.key}
            n={g.lead}
            verb={verdicts.get(g.lead.id)?.verb}
            c={c}
            locale={locale}
            markOne={markOne}
            behind={stacked && i > 0}
          />
        ) : (
          <NoticeRow key={g.key} n={g.lead} c={c} locale={locale} markOne={markOne} />
        ),
      )}
    </ListGroup>
  );
}

/* --------------------------------------------------------------------- rows */

function plateFor(family: NotificationFamily) {
  return (
    <IconPlate size="sm" shape="round" tone={FAMILY_TONE[family]}>
      <UiIcon name={FAMILY_GLYPH[family]} size={ICON_PLATE_GLYPH.sm} />
    </IconPlate>
  );
}

function UnreadMark({ read, c }: { read: boolean; c: Copy }) {
  return read ? null : (
    <>
      <span aria-hidden="true" className="nf-notif__dot" />
      <span className="sr-only">{c.unreadMark}</span>
    </>
  );
}

/** The one figure the row's own words state, drawn tabular beside them. */
function FigureLine({ n, locale }: { n: NotificationItem; locale: Locale }) {
  const minor = figureIn(n.title, n.body);
  if (minor === null) return null;
  return (
    <span className="nf-notif__figure nf-numeric" data-testid="notification-figure">
      {formatMoney(minor, locale)}
    </span>
  );
}

function RowBody({ n, c, locale, family }: { n: NotificationItem; c: Copy; locale: Locale; family: NotificationFamily }) {
  return (
    <>
      <span className="nf-list-row__lead">{plateFor(family)}</span>
      <span className="nf-list-row__text">
        <span className="nf-list-row__title">{n.title}</span>
        {n.body ? <span className="nf-list-row__sub nf-notif__body">{n.body}</span> : null}
        <span className="nf-notif__meta">
          <span className="nf-notif__kind">{c.families[family]}</span>
          <FigureLine n={n} locale={locale} />
          <span className="nf-notif__time nf-numeric">{lagosTimeLabel(n.createdAt)}</span>
        </span>
      </span>
    </>
  );
}

function NoticeRow({
  n,
  c,
  locale,
  markOne,
}: {
  n: NotificationItem;
  c: Copy;
  locale: Locale;
  markOne(id: string): void;
}) {
  const family = familyOf(n);
  return (
    <li className="nf-list-item">
      <Link
        href={rowHref(n, family)}
        onClick={() => !n.read && markOne(n.id)}
        className={`nf-list-row nf-list-row--two nf-notif__row${n.read ? "" : " nf-notif__row--unread"}`}
        data-testid="notification-row"
        data-family={family}
      >
        <RowBody n={n} c={c} locale={locale} family={family} />
        <span className="nf-list-row__end">
          <UnreadMark read={n.read} c={c} />
        </span>
        <UiIcon name="chevron-right" size={16} className="nf-notif__chev" />
      </Link>
    </li>
  );
}

/** Several events on one record: one row that opens to the rows it folds. */
function GroupRow({
  rows,
  c,
  locale,
  markOne,
  behind = false,
}: {
  rows: NotificationItem[];
  c: Copy;
  locale: Locale;
  markOne(id: string): void;
  /** Behind the front card of a stacked "Needs you": seen, not reachable. */
  behind?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lead = rows[0]!;
  const family = familyOf(lead);
  const unread = rows.filter((r) => !r.read).length;
  const title =
    family === "messages" && lead.href?.startsWith("/") && /messages/.test(lead.href)
      ? plural(rows.length, c.group.messages, locale)
      : lead.title;
  return (
    <li className="nf-list-item" inert={behind || undefined}>
      <button
        type="button"
        className={`nf-list-row nf-list-row--two nf-notif__row${unread > 0 ? " nf-notif__row--unread" : ""}`}
        aria-expanded={open}
        aria-label={`${title}. ${open ? c.group.hide : c.group.show}`}
        onClick={() => setOpen((v) => !v)}
        data-testid="notification-bundle"
        data-family={family}
      >
        <span className="nf-list-row__lead">{plateFor(family)}</span>
        <span className="nf-list-row__text">
          <span className="nf-list-row__title">{title}</span>
          <span className="nf-list-row__sub nf-notif__body">{lead.body || lead.title}</span>
          <span className="nf-notif__meta">
            <span className="nf-notif__kind">{plural(rows.length, c.group.updates, locale)}</span>
            <span className="nf-notif__time nf-numeric">{lagosTimeLabel(lead.createdAt)}</span>
          </span>
        </span>
        <span className="nf-list-row__end">
          <UnreadMark read={unread === 0} c={c} />
        </span>
        <UiIcon name="chevron-down" size={16} className="nf-notif__fold" />
      </button>
      {open ? (
        <ul className="nf-notif__bundle">
          {rows.map((n) => (
            <NoticeRow key={n.id} n={n} c={c} locale={locale} markOne={markOne} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** A "Needs you" row: the record, and its one verb beside it. */
function NeedsRow({
  n,
  verb,
  c,
  locale,
  markOne,
  behind = false,
}: {
  n: NotificationItem;
  verb?: SeverityVerb | undefined;
  c: Copy;
  locale: Locale;
  markOne(id: string): void;
  /** Behind the front card of a stacked "Needs you": seen, not reachable. */
  behind?: boolean;
}) {
  const family = familyOf(n);
  return (
    <li className="nf-list-item" inert={behind || undefined}>
      <div
        className="nf-list-row nf-list-row--two nf-notif__row nf-notif__row--unread nf-notif__needs"
        data-testid="notification-row"
        data-family={family}
      >
        <Link
          href={rowHref(n, family)}
          onClick={() => !n.read && markOne(n.id)}
          className="nf-notif__needs-open"
        >
          <RowBody n={n} c={c} locale={locale} family={family} />
        </Link>
        {verb && n.href ? (
          <ButtonLink
            href={n.href}
            size="sm"
            variant="primary"
            onClick={() => !n.read && markOne(n.id)}
            className="nf-notif__verb"
          >
            {c.verbs[verb]}
          </ButtonLink>
        ) : null}
      </div>
    </li>
  );
}
