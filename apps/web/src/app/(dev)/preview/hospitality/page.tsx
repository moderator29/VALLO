import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { PageFrame } from "@/components/app/PageFrame";
import { HotelDashboard } from "@/components/host/dashboard/HotelDashboard";
import { RestaurantSummary } from "@/components/host/dashboard/RestaurantSummary";
import { buildRestaurantFigures } from "@/components/host/dashboard/restaurant-figures";
import { DESK_EMPTY, DESK_NOW, deskFixture } from "../restaurant-desk/fixtures";
import { emptyHotelRead, hotelRead, WEEK_ROWS } from "./fixtures";
import { HostStandingBody } from "@/app/host/HostStandingBody";
import { hostToday } from "@/app/host/today";
import type { MyBusiness } from "@/lib/host/queries";
import "@/app/host/host-desk.css";

/**
 * The hotel and restaurant dashboards (track/hospitality-workspace), from
 * fixtures, on a fixed clock (10:00 Lagos, Tuesday 13 October 2026) so a proof
 * taken twice is the same picture twice. `?view=` picks the screen:
 *
 *   hotel (default)   /host/bookings: the five cards, the front desk and the
 *                     booking calendar
 *   hotel-home        the workspace home's cut of the same
 *   hotel-empty       a hotel with no rooms set up yet
 *   home              the workspace home for a host with a hotel and a restaurant
 *   restaurant        the restaurant home
 *   restaurant-empty  a venue nothing has ever arrived at
 *
 * `?marks=missing` is a database without the check-in migration; `?marks=error`
 * is a read that failed. Real components, made-up rows.
 */
export const dynamic = "force-dynamic";

const BUSINESS: Omit<MyBusiness, "id" | "name" | "slug" | "kind"> = {
  status: "PUBLISHED",
  hostType: null,
  verificationTier: 1,
  verified: false,
  submittedAt: null,
  reviewedAt: null,
  reviewNotes: null,
  createdAt: "2026-09-01T00:00:00.000Z",
};
const BUSINESSES: MyBusiness[] = [
  { ...BUSINESS, id: "biz-hotel", name: "Harbour Hotel", slug: "harbour-hotel", kind: "hotel" },
  { ...BUSINESS, id: "biz-kitchen", name: "Yellow Chilli Ikoyi", slug: "yellow-chilli", kind: "restaurant" },
];

export default async function PreviewHospitality({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : "hotel";
  const marks = params.marks === "missing" || params.marks === "error" ? params.marks : "ok";
  const locale = await getLocale();
  const t = getDictionary(locale);

  if (view === "home") {
    const today = hostToday({ now: DESK_NOW, rooms: null, tables: null, unread: 3, businesses: BUSINESSES, draft: null });
    const figures = buildRestaurantFigures({ board: deskFixture(), now: DESK_NOW, week: WEEK_ROWS, noShowsMonth: 3 });
    return (
      <HostShell logoLabel={t.a11y.logoHome} fallback="/host" wide chromeBack={false} nav>
        <PageFrame title={t.hostNav.overview} back={false} width="wide">
        <HostStandingBody
          businesses={BUSINESSES}
          draft={null}
          locale={locale}
          today={today}
          t={t}
          dashboard={
            <>
              <HotelDashboard read={hotelRead({ marks })} locale={locale} variant="home" t={t} />
              <RestaurantSummary figures={figures} words={t.hostDash.restaurant} locale={locale} />
            </>
          }
        />
        </PageFrame>
      </HostShell>
    );
  }

  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" wide chromeBack={false} nav>
      <PageFrame
        title={view === "restaurant" || view === "restaurant-empty" ? t.hostNav.overview : t.experienceHost.bookings.title}
        back={view === "hotel"}
        fallback="/host"
        width="wide"
      >
      {view === "restaurant" || view === "restaurant-empty" ? (
        <RestaurantSummary
          figures={buildRestaurantFigures({
            board: view === "restaurant" ? deskFixture() : DESK_EMPTY,
            now: DESK_NOW,
            week: view === "restaurant" ? WEEK_ROWS : [],
            noShowsMonth: view === "restaurant" ? 3 : 0,
          })}
          words={t.hostDash.restaurant}
          locale={locale}
        />
      ) : (
        <div className="nf-dash">
          <HotelDashboard
            read={view === "hotel-empty" ? emptyHotelRead() : hotelRead({ marks })}
            locale={locale}
            variant={view === "hotel-home" ? "home" : "page"}
            t={t}
          />
        </div>
      )}
      </PageFrame>
    </HostShell>
  );
}
