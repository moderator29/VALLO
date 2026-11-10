import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getStopsDesk, STOPS_STATUSES } from "@/lib/admin/suspension-queries";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import { adminUi, type AdminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import {
  QueueFilters,
  QueuePager,
  queueNoMatch,
  readQueueQuery,
  type QueueStatusOption,
} from "../_components/QueueFilters";
import { readClosedReasons } from "@/lib/landlord/queries";
import { StopsDesk } from "./StopsDesk";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.nav.stops.label, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * The two chips, from the pair the query itself filters on.
 *
 * `STOPS_STATUSES` lives beside the read rather than here, so the chip row and
 * the `in` clause cannot drift apart. The words come from `ui.statusLabel`,
 * which is where every other status word in this console comes from.
 */
function statusFilters(ui: AdminUi): readonly QueueStatusOption[] {
  return STOPS_STATUSES.map((value) => ({ value, label: ui.statusLabel(value) }));
}

const LEDE =
  "Agents taken off the platform, and everything a stop took down. A stop is not a deletion: their listings come back where they were the moment it is lifted, unless one was closed as let or unavailable in the meantime, and confirmed stays are never cancelled.";

/**
 * Stops: taking an agent off the platform, and putting them back.
 *
 * `public.agent_suspensions` has recorded every stop since 20260805110426 and
 * `suspend_agent` and `reinstate_agent` have been able to write them for just
 * as long. Nothing has ever called either one and nothing has ever shown the
 * table. A stop was a thing the database could do and the platform could not.
 *
 * This is the surface for both halves of it. There is no separate confirmation
 * step, deliberately: a confirm dialog on a decision this size adds a click and
 * removes nothing, because the thing that actually prevents a mistake is seeing
 * what will happen, which is on the card. The reason field is the real gate,
 * and it is required.
 *
 * ---------------------------------------------------------------------------
 * AND IT HAD NO WAY TO FIND ANYBODY.
 *
 * Two lists of every approved agent on the platform, ordered by name, with no
 * search, no filter and no pager, on the screen whose entire job is "find one
 * person and decide about them". Twelve of the console's nineteen destinations
 * had the shared queue frame and this was not one of them. F2-055.
 *
 * The narrowing is in the query, on the first read, before the four reads that
 * fan out from it. See `getStopsDesk`.
 *
 * NO DATE RANGE HERE. The only date on this screen belongs to a stop, and most
 * of the agents listed have never had one, so From and To would narrow nothing
 * or silently empty half the desk. `dateable={false}` says so rather than
 * drawing two controls that do not work.
 */
export default async function AdminStopsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const common = t.admin.common;

  const query = readQueueQuery(await searchParams);
  const read = await getStopsDesk({
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.offset ? { offset: query.offset } : {}),
  });

  if (read.state !== "ready") {
    return (
      <div className="nf-console">
        <PageHead title={t.admin.nav.stops.label} lede={LEDE} />
        <ui.QueueUnavailable />
      </div>
    );
  }

  /* Which withdrawn listings were closed as let or unavailable since. A closed
     listing is held down by the database whatever a lift does, so the desk says
     "closed, stays closed" rather than promising it back. Fails soft to none. */
  const withdrawnIds = [...read.stopped, ...read.trading].flatMap((agent) =>
    [agent.openStop, ...agent.pastStops].flatMap((stop) => stop?.withdrawn.map((w) => w.id) ?? []),
  );
  const closedIds = Object.keys(await readClosedReasons(withdrawnIds));

  const shown = read.stopped.length + read.trading.length;
  /* Page two of a desk that has run out is a RESULT, not "nobody has ever been
     here", so the offset counts towards the narrowed reading exactly as it does
     on the other queues. */
  const narrowed = read.narrowed || (query.offset ?? 0) > 0;
  const noMatch = queueNoMatch(common);

  return (
    <div className="nf-console">
      <PageHead
        title={t.admin.nav.stops.label}
        lede={LEDE}
        trail={<ui.WaitingBadge count={read.stopped.length} />}
      />
      {/* The person file is this desk's child in the hierarchy; the member
          search is its front door for someone who is not a lister. */}
      <p className="mb-row nf-caption">
        <Link href="/admin/people" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          Find any member by name, handle, email or id
        </Link>
      </p>

      <QueueFilters
        base="/admin/stops"
        query={query}
        common={common}
        statuses={statusFilters(ui)}
        dateable={false}
        searchLabel="Find an agent"
        searchPlaceholder="Agent name"
      />

      {shown === 0 ? (
        <ui.QueueEmpty
          title={narrowed ? noMatch.title : "No agents to show"}
          body={
            narrowed
              ? noMatch.body
              : "Nobody has been approved to trade yet, so there is nobody to stop and nobody to put back."
          }
          state={narrowed ? "no-match" : "never"}
        />
      ) : (
        <StopsDesk stopped={read.stopped} trading={read.trading} closedIds={closedIds} recallCopy={t.trustVisible.desk} />
      )}

      <QueuePager
        base="/admin/stops"
        query={query}
        pageSize={QUEUE_PAGE_SIZE}
        full={read.hasMore}
        count={shown}
      />
    </div>
  );
}
