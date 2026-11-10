import { getLocale } from "@/lib/locale";
import { countOf } from "@vallo/i18n/core";
import { readInternalIds } from "@/lib/admin/internal-accounts";
import { getSendBackReasons } from "@/lib/admin/reads/review-reasons";
import { getBookingOutcomes, getPriceCheckDemand, getSupplySeries, getThinAreas } from "@/lib/admin/reads/analytics";
import type { CollectedRange } from "@/lib/admin/reads/shapes";
import { LiveRefresh } from "../_components/LiveRefresh";
import { AnalyticsView } from "./AnalyticsView";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { analyticsContext } from "@/lib/admin/copilot/contexts/analytics";

export const dynamic = "force-dynamic";

const RANGES: readonly CollectedRange[] = ["30d", "90d", "12m"];

function requestTime(): number {
  return Date.now();
}

/**
 * Analytics. Reads under the admin gate, through the operator's own session:
 * `getBookingOutcomes`, `getSupplySeries` and `getThinAreas`
 * (`lib/admin/reads/analytics.ts`). Everything the platform does not record
 * is marked as such on the page, with its request.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const range = RANGES.find((r) => r === params.range) ?? "30d";
  const now = requestTime();
  const [bookings, supply, thin, demand, internal, reasons] = await Promise.all([
    getBookingOutcomes(range, now),
    getSupplySeries(range, now),
    getThinAreas(5),
    getPriceCheckDemand(range, now),
    readInternalIds(),
    getSendBackReasons(now),
  ]);
  return (
    <>
      <LiveRefresh />
      <AnalyticsView
        locale={locale}
        range={range}
        bookings={bookings.state === "ok" ? bookings.data : null}
        supply={supply.state === "ok" ? supply.data : null}
        thin={thin.state === "ok" ? thin.data : null}
        demand={demand.state === "ok" ? demand.data : null}
        sentBack={reasons.state === "ok" ? reasons.data.filter((r) => r.count > 0) : null}
      />
      {/* C10: the figures above leave these accounts out; the count is read, not assumed. */}
      <p className="nf-caption mt-block">
        Internal activity excluded: {countOf(internal.length, "accounts", locale)} (QA, staff and
        anyone marked on the staff page). Example listings are left out as well.
      </p>
      <DeskCopilot
        scope="analyst"
        deskName="Analytics"
        context={analyticsContext({
          range,
          internalAccountsExcluded: internal.length,
          live: {
            bookings: bookings.state === "ok",
            supply: supply.state === "ok",
            thinAreas: thin.state === "ok",
            demand: demand.state === "ok",
          },
        })}
      />
    </>
  );
}
