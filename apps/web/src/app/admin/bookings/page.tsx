import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getReservationWaitingCount } from "@/lib/admin/bookings-queries";
import { getBookingsDesk } from "@/lib/admin/reads/bookings";
import { getBadgeTiers } from "@/lib/admin/reads/badges";
import { readPage } from "@/lib/admin/reads/money-derive";
import { adminUi } from "../_components/ui";
import { readQueueQuery } from "../_components/QueueFilters";
import { flatParams } from "../money/_desk/Desk";
import { DeskLinks } from "../_components/panels";
import { BookingsDesk } from "./BookingsDesk";
import "../money/_desk/desk.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.bookings.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/** Stays per page. */
const STAYS_PAGE_SIZE = 12;

/**
 * The stays desk.
 *
 * Every figure is `getBookingsDesk` (`lib/admin/reads/bookings.ts`), which
 * reads every booking once and checks the count, so no figure is the total of
 * a capped list. The table's rows open the stay's own page
 * (`/admin/bookings/[bookingId]`), which is where the only write on this desk
 * lives: the cancel-and-refund (`cancelBookingAsAdmin`, with the
 * refund worked out by `previewCancellation` from the published schedule),
 * unchanged. The restaurant tables queue keeps its own route and its waiting
 * count (`getReservationWaitingCount`).
 */
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const params = await searchParams;
  const query = readQueueQuery(params);

  const [desk, waiting] = await Promise.all([
    getBookingsDesk({
      ...(query.q ? { q: query.q } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      page: readPage(params.page),
      pageSize: STAYS_PAGE_SIZE,
    }),
    getReservationWaitingCount(),
  ]);
  const tiers = await getBadgeTiers(desk.state === "ok" ? desk.data.table.rows.map((r) => r.guestId) : []);

  return (
    <>
      {/* The desks the menu files under this one, as buttons: this desk drew
          none of them, so reaching Visits or Reservations meant going back to the menu. */}
      <div className="nf-console">
        <DeskLinks deskKey="bookings" label="The other booking desks" caption="More in this desk" />
      </div>
      <BookingsDesk
        tiers={tiers}
        desk={desk.state === "ok" ? desk.data : null}
        t={t}
        ui={ui}
        common={t.admin.common}
        query={query}
        params={flatParams(params)}
        locale={locale}
        waitingTables={waiting.state === "ok" ? waiting.data : null}
      />
    </>
  );
}
