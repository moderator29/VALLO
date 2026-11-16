import { HostShell } from "@/components/host/HostShell";
import { PageHeader } from "@/components/app/PageHeader";
import { RateCalendar } from "@/components/host/calendar/RateCalendar";
import { addMonths, lagosToday } from "@/lib/host/rate-calendar";
import { ROOMS, SYNC_READY, calendarRows } from "../fixtures";

/** C1 and C2 on fixtures. `?sync=off` draws the panel before the migration. */
export default async function PreviewHostCalendar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const today = lagosToday();
  const rows = calendarRows(today);
  const month = typeof p.month === "string" ? p.month : today.slice(0, 7);
  return (
    <HostShell fallback="/preview/host-c" wide chromeBack={false} nav>
      <PageHeader variant="large" back={false} title="Calendar" subtitle="Example: Marina Court Hotel" />
      <RateCalendar
          key={month}
        accommodationName="Example: Marina Court Hotel"
        businessId="preview"
        rooms={ROOMS}
        rates={rows.rates}
        inventory={rows.inventory}
        imported={rows.imported}
        month={month}
        today={today}
        initialRoomId={null}
        maxMonth={addMonths(today.slice(0, 7), 18)}
        sync={p.sync === "off" ? { ready: false, feeds: [], imports: [] } : SYNC_READY}
        feedBase="https://vallospaces.com"
        locale="en"
      />
    </HostShell>
  );
}
