import { ButtonLink } from "@/components/ui/Button";
import { getDictionary, type Locale } from "@vallo/i18n";
import type { HotelDeskRead } from "@/lib/host/tape-chart-read";
import { buildHotelModel } from "@/lib/host/front-desk-model";
import { hotelFeeSentence } from "@/lib/host/hotel-fee";
import { HotelSummary } from "./HotelSummary";
import { FrontDeskPanel } from "./FrontDeskPanel";
import { TapeChart } from "@/components/host/tape-chart/TapeChart";
import "./dashboard.css";

type Ok = Extract<HotelDeskRead, { state: "ok" }>;

/**
 * The hotel's dashboard, from one read. `home` is the workspace home's cut:
 * the five cards, the front desk with a few rows each, and a door to the
 * calendar. `page` is /host/bookings: the cards, the whole front desk and the
 * booking calendar (the tape chart).
 *
 * Nothing here fetches. The route (or a preview) passes the read.
 */
export function HotelDashboard({
  read,
  locale,
  variant,
  t = getDictionary(locale),
}: {
  read: Ok;
  locale: Locale;
  variant: "home" | "page";
  t?: ReturnType<typeof getDictionary>;
}) {
  const words = t.hostDash;
  const { desk, chart } = buildHotelModel({
    today: read.today,
    roomTypes: read.roomTypes,
    inventory: read.inventory,
    stays: read.stays,
    events: read.marks.state === "ok" ? read.marks.events : null,
  });

  return (
    <div className="nf-dash" data-testid={`hotel-dashboard-${variant}`}>
      <HotelSummary desk={desk} chart={chart} revenue={read.revenue} words={words.hotel} locale={locale} />
      {variant === "home" ? (
        <p className="nf-dash__lede" data-testid="hotel-fee">
          {hotelFeeSentence()}
        </p>
      ) : null}
      <FrontDeskPanel
        desk={desk}
        marks={read.marks.state}
        words={words.desk}
        locale={locale}
        limit={variant === "home" ? 4 : undefined}
        columns
        showHotel={new Set(read.roomTypes.map((room) => room.hotel)).size > 1}
        moreHref="/host/bookings"
      />
      {variant === "page" ? (
        <div className="nf-dash">
          <div className="nf-dash__head">
            <h2 className="nf-dash__title">{words.tape.title}</h2>
            <p className="nf-dash__lede">{words.tape.lede}</p>
          </div>
          <TapeChart chart={chart} words={words.tape} locale={locale} truncated={read.truncated ? read.stays.length : 0} />
        </div>
      ) : (
        /* A real button rather than a quiet link floating between the front
           desk and whatever comes next: the one way from the home's cut of the
           desk into the whole calendar (workspace phone pass). */
        <ButtonLink
          href="/host/bookings"
          variant="secondary"
          leadingIcon="calendar-check"
          arrow
          className="justify-self-start"
          data-testid="open-calendar"
        >
          {words.hotel.calendarLink}
        </ButtonLink>
      )}
    </div>
  );
}
