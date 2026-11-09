import Link from "next/link";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { adminUi } from "./ui";
import { PageHead } from "./panels";

/**
 * THE CONSOLE'S FRONT DOOR, DRAWN FROM COUNTS IT IS HANDED.
 *
 * The founder's item 5, in his words: "Going into the admin console should
 * land on the overview, every time, before any individual desk. Right now it
 * drops straight into an area. Overview first, then I choose where to go."
 *
 * WHAT USED TO BE AT `/admin`. A unified queue table: five readers folded
 * into one list, a tab strip, a filter bar and forty rows. It is a good
 * screen and it is an AREA - one way of working, chosen for you, before you
 * have said what you came to do. It has moved intact to `/admin/queue`, it is
 * the first thing this page offers, and it is the row directly under Overview
 * in the console rail. Nothing became harder to reach; it simply stopped
 * being what opening the console means.
 *
 * WHY THE COUNTS ARE A PROP. The page above this one reads them under the
 * admin gate and hands them down, which keeps this file free of the database
 * and lets the dev preview draw the same surface from fixtures. THAT IS THE
 * ONLY REASON. Nothing here decides what a number is; it decides how a number
 * is drawn.
 *
 * EVERY NUMBER IS A DATABASE COUNT. `getQueueCounts` runs seven
 * `head: true, count: "exact"` reads under the same admin gate the desks use,
 * and this draws what comes back and nothing else. There is no trend, no "up
 * from last week" and no total-processed figure, because nothing in this
 * schema records a point in time from which such a number could be derived: a
 * count the database cannot produce is not printed. When the counts cannot be
 * read at all the page above says so rather than drawing zeroes, which is the
 * one lie a console of this kind must never tell - an operator who sees seven
 * zeroes goes home.
 */

/** The count keys this surface draws, which are also the copy keys. */
export type OverviewCounts = {
  flags: number;
  moderation: number;
  alerts: number;
  reports: number;
  applications: number;
  listings: number;
  tickets: number;
};

/**
 * The desks, in the order `nav.ts` argues for: safety first, then supply,
 * then the human queues.
 *
 * The key is the count key AND the copy key, so a tile cannot draw one
 * queue's number under another queue's name. The hrefs are the desks' own,
 * which is why `applications` goes to `/admin/agents` and `tickets` to
 * `/admin/support`: the dictionary names the WORK and the rail names the
 * DESK, and they were never the same word.
 */
export const DESKS: { key: keyof OverviewCounts; href: string; icon: UiIconName }[] = [
  { key: "flags", href: "/admin/queue?tab=flags", icon: "chat-bubble" },
  { key: "moderation", href: "/admin/queue?tab=held", icon: "sliders" },
  { key: "alerts", href: "/admin/alerts", icon: "bell" },
  { key: "reports", href: "/admin/queue?tab=reports", icon: "flag" },
  { key: "applications", href: "/admin/agents", icon: "user" },
  { key: "listings", href: "/admin/listings", icon: "building-apartment" },
  { key: "tickets", href: "/admin/support", icon: "ticket" },
];

export function ConsoleOverview({
  t,
  locale,
  counts,
}: {
  t: Dictionary;
  locale: Locale;
  counts: OverviewCounts;
}) {
  const o = t.admin.overview;
  const ui = adminUi(t, locale);
  /* The headline number is the sum of what the tiles below already show, so
     it can never disagree with them: one read, one arithmetic, printed twice. */
  const waiting = DESKS.reduce((total, desk) => total + counts[desk.key], 0);

  return (
    <div className="nf-console">
      <PageHead title={o.title} lede={o.lede} trail={<ui.WaitingBadge count={waiting} />} />

      <ui.Section title={o.deskTitle} hint={o.deskLede}>
        <ul className="nf-admin-tiles">
          {DESKS.map((desk) => {
            const copy = o.tiles[desk.key];
            const count = counts[desk.key];
            return (
              <li key={desk.key}>
                <Link href={desk.href} className="nf-admin-tile">
                  <span className="nf-admin-tile__head">
                    <UiIcon name={desk.icon} size="md" className="nf-admin-tile__glyph" />
                    <span className="nf-admin-tile__label">{copy.label}</span>
                    {/* The count is drawn even at zero, and that is deliberate:
                        a desk with nothing waiting is a FACT an operator wants,
                        and hiding the number would make an empty queue look
                        like an unread one. `queueClear` says it in words under
                        the figure, so the zero is never left to carry the
                        meaning alone. */}
                    <span className="nf-admin-tile__count nf-numeric">{count}</span>
                  </span>
                  <span className="nf-admin-tile__lede">
                    {count === 0 ? o.queueClear : copy.lede}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </ui.Section>

      <ui.Section title={o.queueLink}>
        <Link href="/admin/queue" className="nf-admin-tile">
          <span className="nf-admin-tile__head">
            <UiIcon name="grid" size="md" className="nf-admin-tile__glyph" />
            <span className="nf-admin-tile__label">{o.queueTitle}</span>
            <UiIcon name="chevron-right" size="sm" className="nf-admin-tile__chev" />
          </span>
          <span className="nf-admin-tile__lede">{o.queueLinkLede}</span>
        </Link>
      </ui.Section>

      {/* The three facts a new operator has to be told, and the reason they
          are on the front door rather than in a help page: the audit log, the
          notifications and the invisibility of the safety scan all change how
          somebody works before they touch a single row. */}
      <ui.Section title={o.how.title}>
        <ul className="nf-admin-how">
          <li>{o.how.audit}</li>
          <li>{o.how.notify}</li>
          <li>{o.how.invisible}</li>
        </ul>
      </ui.Section>
    </div>
  );
}
