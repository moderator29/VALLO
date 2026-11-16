import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { HostTablesBody } from "@/app/host/reservations/HostTablesBody";
import LoadingHostReservations from "@/app/host/reservations/loading";
import { DESK_EMPTY, DESK_NOW, deskFixture } from "./fixtures";

/**
 * The host table desk (track/restaurant-desk), from fixtures, on a fixed
 * clock (18:00 Lagos, Tuesday 13 October 2026) so a proof taken twice is the
 * same picture twice. `?state=` picks the state:
 *
 *   (none)    a working evening: requests with and without a guest record,
 *             confirmed tables tonight, a seated lunch, a no-show, tomorrow
 *             and later in the week, and what has gone
 *   empty     a venue nothing has ever arrived at
 *   error     the read failed
 *   loading   the route's own loading screen
 *
 * Real components, made-up rows. Never proof of a read, only of the look.
 */
export const dynamic = "force-dynamic";

export default async function PreviewRestaurantDesk({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : "";
  if (state === "loading") return <LoadingHostReservations />;

  const locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" wide chromeBack={false} nav>
      <HostTablesBody
        copy={t.hostWorkspace}
        words={t.experienceHost}
        desk={t.tableDesk}
        locale={locale}
        now={DESK_NOW}
        board={state === "error" ? null : state === "empty" ? DESK_EMPTY : deskFixture()}
        unavailable={state === "error"}
      />
    </HostShell>
  );
}
