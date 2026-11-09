import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getStandingDesk } from "@/lib/admin/standing-queries";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import { adminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import {
  QueueFilters,
  QueuePager,
  queueNoMatch,
  readQueueQuery,
} from "../_components/QueueFilters";
import { StandingDesk } from "./StandingDesk";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.nav.standing.label, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

const LEDE = "Badges Vallo grants by hand, and the record of who granted them.";

/**
 * Standing: the badges a person grants rather than a trigger awards.
 *
 * Seven of the fourteen badges award themselves from event triggers, which is
 * the right way round: standing that can be earned should be earned. Exactly
 * one is marked manual_only, and the database refuses to store it without the
 * name of the admin who granted it (RM021).
 *
 * This is the desk for that one act, and the record of every time it has been
 * used. A feature with no admin control is a feature nobody can fix at three
 * in the morning; this is the control.
 *
 * ---------------------------------------------------------------------------
 * THE RECORD WAS CAPPED AT A HUNDRED ROWS AND HAD NO WAY TO REACH ROW 101.
 *
 * No search, no badge filter, no date range, no pager, and a hard `.limit(100)`
 * underneath. This is an audit record: the question it exists to answer is "who
 * gave that person that badge, and when", and it could only answer it about the
 * hundred most recent grants. Twelve of the console's nineteen destinations had
 * the shared queue frame; this was not one of them. F2-055.
 *
 * THE CHIPS ARE THE BADGES THEMSELVES. Every other queue's chips come from a
 * database enum; there is no enum here, so they come from the `badges` rows the
 * read has already restricted itself to, which is the same guarantee by a
 * different route: a chip cannot offer a badge this desk would not show.
 */
export default async function AdminStandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const common = t.admin.common;

  const query = readQueueQuery(await searchParams);
  const read = await getStandingDesk({
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.offset ? { offset: query.offset } : {}),
  });

  if (read.state !== "ready") {
    return (
      <div className="nf-console">
        <PageHead title={t.admin.nav.standing.label} lede={LEDE} />
        <ui.QueueUnavailable />
      </div>
    );
  }

  const narrowed = read.narrowed || (query.offset ?? 0) > 0;
  const noMatch = queueNoMatch(common);

  return (
    <div className="nf-console">
      {/* No count beside the title: the queue header's count reads "waiting",
          and a badge somebody holds is not waiting on anybody. The record below
          is the count. */}
      <PageHead title={t.admin.nav.standing.label} lede={LEDE} />

      {/*
        THE GRANT FORM IS ALWAYS DRAWN. This used to short-circuit to the empty
        state when the record held no row, and the form lives in the desk, so
        the first badge could never be granted from the one desk whose empty
        copy says to grant it here. The empty state is now the record's, and
        the search narrows the record it sits above.
      */}
      <StandingDesk
        grants={read.grants}
        manualBadges={read.manualBadges}
        filters={
          <>
            <QueueFilters
              base="/admin/standing"
              query={query}
              common={common}
              statuses={read.manualBadges.map((badge) => ({ value: badge.code, label: badge.name }))}
              searchLabel="Find a holder"
              searchPlaceholder="Name of the person who holds it"
            />
            {/*
              THE ONE THING PAGING FORWARD CANNOT FIX, SAID WHERE IT HAPPENS.

              A name search resolves people first and then reads their grants, so a
              term matching more people than the profile read will return leaves rows
              out that no Next link will ever reach. Silence here would hand an
              operator a desk that looks complete. It is drawn in the pending colour
              because nothing has failed: the answer is partial, not wrong.
            */}
            {read.holderSearchCapped && (
              <p
                role="status"
                className="nf-body-sm mb-block rounded-lg border border-[color-mix(in_oklab,var(--nf-status-pending)_45%,transparent)] bg-[var(--nf-status-pending-surface)] p-row leading-relaxed text-[var(--nf-content-secondary)]"
              >
                That name matches more people than this search reads, so grants held by
                some of them are not below. Paging forward will not reach them. Narrow
                the name and search again.
              </p>
            )}
          </>
        }
        empty={
          <ui.QueueEmpty
            title={narrowed ? noMatch.title : "No badge has been granted by hand"}
            body={
              narrowed
                ? noMatch.body
                : "Every badge on the platform so far was awarded by a trigger. The moment somebody grants one with the form above, it and the name against it appear here."
            }
            state={narrowed ? "no-match" : "never"}
          />
        }
      />

      <QueuePager
        base="/admin/standing"
        query={query}
        pageSize={QUEUE_PAGE_SIZE}
        full={read.hasMore}
        count={read.grants.length}
      />
    </div>
  );
}
