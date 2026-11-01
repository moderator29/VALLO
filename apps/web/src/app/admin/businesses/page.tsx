import type { Metadata } from "next";
import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { BUSINESS_STATUSES, getBusinessQueue } from "@/lib/admin/business-queries";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import { adminUi, type AdminUi } from "../_components/ui";
import {
  QueueFilters,
  QueuePager,
  queueNarrowed,
  readQueueQuery,
  type QueueStatusOption,
} from "../_components/QueueFilters";
import { BusinessCard } from "./BusinessCard";

export const metadata: Metadata = {
  title: "Businesses",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The operator desk for hosts: read an application, decide it, record the
 * rungs, and put the venue in front of guests.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS ROUTE DID NOT EXIST UNTIL NOW, WHICH IS THE POINT OF IT.
 *
 * `lib/admin/business-actions.ts` and `lib/admin/business-queries.ts` have
 * been written, commented and complete for two days, and NOTHING IMPORTED
 * EITHER OF THEM. The decisions were all there; the door was missing. So the
 * only way a restaurant could ever reach the shelf was somebody writing SQL by
 * hand, which is exactly what happened to the first first-party venue (ledger
 * 12.5) and is not a process a founder can run while signing a venue.
 *
 * This file is therefore mostly a reading surface. It writes no rules: every
 * decision below is one of the six actions that already existed, and the one
 * new action (`publishRestaurant`) states its own gate in its own header.
 *
 * ---------------------------------------------------------------------------
 * WHAT A REVIEWER IS SHOWN, AND WHY EACH PART EARNS ITS PLACE.
 *
 * The readiness list first, because it is the answer to the only question the
 * reviewer is actually here to settle: can this go live, and if not, what is
 * missing. It separates what BLOCKS publishing from what merely makes the page
 * thin, because those are different conversations with the host and running
 * them together is how a venue waits a week for a photograph nothing requires.
 *
 * Then the application: the representative, the CAC number to compare against
 * the free public search, the bank name the BANK returned beside the names on
 * the paperwork, the three consents as three dated facts, and the documents
 * behind short-lived signed URLs.
 *
 * Then the ladder, and then the decisions.
 *
 * ---------------------------------------------------------------------------
 * THE BADGE. THIS DESK CANNOT LIGHT ONE ON A VENUE NOBODY CHECKED.
 *
 * `businesses.verified` is derived by trigger from the identity rung, so the
 * identity control is the only button in the product that can produce a
 * verified mark. It is disabled while no identity document is on file, and the
 * panel says plainly what the mark does and does not mean today: a restaurant
 * on the business spine shows NO verified mark on its own page under any
 * combination of rungs, because the page and the catalogue projection derive
 * that mark from a different column entirely (ledger 12.6). Recording a rung
 * here is a record about a person, never a decoration on a listing, and
 * nothing on this screen should be read as promising the host a badge.
 */

const LEDE =
  "Host applications, the four verification rungs, and the decision that puts a venue in front of guests. A refusal and a change request carry your words to the host exactly as you type them.";

const STATUS_FILTERS = (ui: AdminUi): readonly QueueStatusOption[] =>
  BUSINESS_STATUSES.map((value) => ({ value, label: ui.statusLabel(value) }));

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  const params = await searchParams;
  const query = readQueueQuery(params);
  const narrowed = queueNarrowed(query);
  /* Who is reading, so a reviewer's own business is drawn without the
     controls the actions would refuse them (`isOwnBusiness`). The session is
     read once per request. */
  const session = await resolveSession();
  /* The founder may decide their own business; everybody else's own case is withheld. */
  const founder =
    session.state === "signed-in" ? (await session.supabase.rpc("am_i_founder" as never)).data === true : false;
  const viewerId = session.state === "signed-in" && !founder ? session.user.id : null;
  const queue = await getBusinessQueue({
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.offset ? { offset: query.offset } : {}),
  });

  if (queue.state !== "ok") {
    return (
      <div className="nf-console">
        <ui.QueueHeader title="Businesses" lede={LEDE} />
        <ui.QueueUnavailable />
      </div>
    );
  }

  const { rows, full, waitingCount } = queue.data;

  return (
    <div className="nf-console">
      <ui.QueueHeader title="Businesses" lede={LEDE} count={waitingCount} />

      <QueueFilters
        base="/admin/businesses"
        query={query}
        common={common}
        statuses={STATUS_FILTERS(ui)}
        searchPlaceholder="Search by name or city"
      />

      {rows.length === 0 ? (
        narrowed ? (
          <ui.QueueEmpty title={common.noMatchTitle} body={common.noMatchBody} state="no-match" />
        ) : (
          <ui.QueueEmpty
            title="No applications yet"
            body="A host who sends an application from the host wizard appears here straight away, with their papers, their hours and their bank name."
            everHadRows={false}
          />
        )
      ) : (
        <ul className="nf-queue-list">
          {rows.map((row) => (
            <BusinessCard key={row.id} row={row} ui={ui} viewerId={viewerId} />
          ))}
        </ul>
      )}

      <QueuePager
        base="/admin/businesses"
        query={query}
        pageSize={QUEUE_PAGE_SIZE}
        full={full}
        count={rows.length}
      />
    </div>
  );
}
