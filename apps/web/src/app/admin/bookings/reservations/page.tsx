import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getReservationBoard } from "@/lib/admin/bookings-queries";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import { adminUi } from "../../_components/ui";
import { PageHead } from "../../_components/panels";
import {
  QueueFilters,
  QueuePager,
  queueNarrowed,
  readQueueQuery,
} from "../../_components/QueueFilters";
import { ReservationGroup, reservationStatusFilters } from "./ReservationCard";

export const metadata: Metadata = {
  title: "Reservations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BASE = "/admin/bookings/reservations";

/**
 * Restaurant reservations, under the console's eye.
 *
 * A host answers a request from their own board and, when they do not, the
 * guest waits on a table nobody has said yes or no to. This queue is where
 * an operator sees that and answers on the host's behalf, and where a
 * confirmed table can be called off by Vallo with a reason the guest reads.
 * Requests come first because they are the only rows anybody is waiting on.
 * The cards themselves are in `ReservationCard.tsx`, shared with the preview
 * harness so what is screenshotted is what the desk draws.
 */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const common = t.admin.common;
  const ui = adminUi(t, locale);
  const guestsWord = t.counts.guests;

  const params = await searchParams;
  const query = readQueueQuery(params);
  const board = await getReservationBoard({
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.offset ? { offset: query.offset } : {}),
  });

  const back = (
    <Link href="/admin/bookings" className="nf-chip mb-md inline-flex w-fit items-center gap-2xs">
      All stays
    </Link>
  );

  if (board.state !== "ok") {
    return (
      <div className="nf-console">
        <PageHead lead={back} title="Reservations" lede="Tables asked for at restaurants on Vallo." />
        <ui.QueueUnavailable />
      </div>
    );
  }

  const { requests, upcoming, past, full, waiting } = board.data;
  const shown = requests.length + upcoming.length + past.length;
  const narrowed = queueNarrowed(query) || (query.offset ?? 0) > 0;

  return (
    <div className="nf-console">
      <PageHead
        lead={back}
        title="Reservations"
        lede="Tables asked for at restaurants on Vallo. Nothing here moves money."
        trail={<ui.WaitingBadge count={waiting} />}
      />

      <QueueFilters
        base={BASE}
        query={query}
        common={common}
        statuses={reservationStatusFilters(ui)}
        searchLabel="Find a table"
        searchPlaceholder="Reservation id or restaurant"
      />
      {/* The date range narrows by when the table is FOR, not when it was
          asked for, because "which tables are on Saturday" is the question. */}
      <p className="nf-caption -mt-row mb-block">
        The dates narrow by when the table is for.
      </p>

      {shown === 0 ? (
        <ui.QueueEmpty
          title={narrowed ? common.noMatchTitle : "No tables yet"}
          body={
            narrowed
              ? common.noMatchBody
              : "Reservations appear here the moment a guest asks for a table. Nothing on this screen is waiting on you."
          }
          state={narrowed ? "no-match" : "never"}
        />
      ) : (
        <>
          <ReservationGroup
            title="Waiting on the restaurant"
            rows={requests}
            ui={ui}
            guestsWord={guestsWord}
          />
          <ReservationGroup
            title="Confirmed and ahead"
            rows={upcoming}
            ui={ui}
            guestsWord={guestsWord}
          />
          <ReservationGroup
            title="Already over or cancelled"
            rows={past}
            ui={ui}
            guestsWord={guestsWord}
          />
        </>
      )}

      <QueuePager base={BASE} query={query} pageSize={QUEUE_PAGE_SIZE} full={full} count={shown} />
    </div>
  );
}
