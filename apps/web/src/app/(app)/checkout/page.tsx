import type { Metadata } from "next";
import { bpsAsPercentText } from "@/lib/money/percent";
import { stayDateLabel } from "@/lib/stays/date-label";
import { redirect } from "next/navigation";
import { getDictionary, plural } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getStayDetail } from "@/lib/stays/queries";
import { readStayDates } from "@/components/app/stays/model";
import { PageFrame } from "@/components/app/PageFrame";
import { ResultScreen } from "@/components/app/ResultSheet";
import { Amount } from "@/components/ui/Amount";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Panel } from "@/components/ui/Panel";
import { ICON, TYPE } from "@/components/app/Screen";
import { formatMoneyDate } from "@/lib/money/dates";
import { cancelStanding, termsFromPolicyRules } from "@/lib/trust/cancellation";
import { ROOM_BOOKINGS_FLAG, STAYS_INSTANT_PAY_FLAG, flagIsOn } from "@/lib/flags/read";
import { resolveSession } from "@/lib/actions/session";
import { returnHref } from "@/components/auth/auth-intent";
import { withNext } from "@/lib/auth/next-link";
import { ButtonLink } from "@/components/ui/Button";
import { RoomRequestForm } from "./RoomRequestForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

/**
 * Where a room's Reserve control lands: `/checkout?stay=…&room=…&rate=…`.
 *
 * THE HONEST STATE, NOT A DEAD LINK. The rate sheet on `/stay/[id]` builds
 * this address (`reserveHref` in RoomTypes.tsx) and until now nothing
 * answered it, so the one control that says Reserve opened a page that did
 * not exist. A booking row still needs `bookings.listing_id` to point at a
 * catalogue listing; the relaxation that lets it carry a business-grade
 * room (M6) is drafted and waits on the founder's word. So this screen says
 * exactly what is true: what was picked, that nothing was held, that
 * nothing was charged, and where to go. When M6 lands, the reserve action
 * writes the row here and this page hands over to `/checkout/[bookingId]`.
 *
 * Every figure is read again from the property's own rate plan, never from
 * the address bar: a query string names a plan, it never prices one.
 */
export default async function RoomCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const stayId = typeof query.stay === "string" ? query.stay : "";
  const roomId = typeof query.room === "string" ? query.room : "";
  const rateId = typeof query.rate === "string" ? query.rate : "";
  if (!stayId) redirect("/stays");

  const [locale, detail, roomsOn, instantOn, session] = await Promise.all([
    getLocale(),
    getStayDetail(stayId),
    flagIsOn(ROOM_BOOKINGS_FLAG),
    /* D73: words only. The database decides whether each booking is instant. */
    flagIsOn(STAYS_INSTANT_PAY_FLAG),
    resolveSession(),
  ]);
  const t = getDictionary(locale);
  const copy = t.stayDetail;
  const { checkIn, checkOut, nights, guests } = readStayDates(query);

  const room = detail?.room_types.find((row) => row.id === roomId) ?? null;
  const plan = room?.rate_plans.find((row) => row.id === rateId) ?? null;
  const total = plan && nights !== null && nights > 0 ? plan.rate_minor * nights : null;
  /* V-20 and V-24. The chosen rate's own cancellation terms, as a date, under
     the total; and the stay's dates as weekdays rather than ISO strings. The
     terms come from the policy's rules, never its sentence. */
  const cancelCopy = t.afterTheGate.cancel;
  const checkInHour = Number.parseInt(detail?.accommodation.check_in_from ?? "", 10);
  const terms = plan?.policy
    ? termsFromPolicyRules(plan.policy.id, plan.policy.rules, Number.isInteger(checkInHour) ? checkInHour : 15)
    : null;
  // A closed free window is never printed as a promise: from now the rate
  // is priced by its next tier (a dynamic route, so this is the reading time).
  const standing = terms && checkIn ? cancelStanding(terms, checkIn, new Date()) : null;
  const cancelLine = standing
    ? standing.kind === "free"
      ? cancelCopy.freeUntil.replace("{date}", formatMoneyDate(standing.until, locale, { withTime: true }) ?? "")
      : standing.kind === "share"
        ? cancelCopy.shareNow.replace("{percent}", bpsAsPercentText(standing.refundBps))
        : cancelCopy.nonRefundable
    : null;
  const backHref = detail
    ? `/stay/${detail.accommodation.id}${checkIn && checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}` : ""}`
    : "/stays";

  return (
    <PageFrame title={t.checkout.title} subtitle={detail?.accommodation.name} fallback={backHref} width="narrow">
      <div>

      {detail && room && plan && (
        <Panel variant="card" aria-labelledby="nf-room-pick" data-testid="room-pick">
          <h2 id="nf-room-pick" className="nf-h3">
            {room.name}
          </h2>
          <p className={`mt-2xs ${TYPE.rowMeta}`}>
            {plan.name} &middot; {copy.sleeps.replace("{count}", String(room.sleeps))}
          </p>
          <dl className="mt-md grid gap-xs border-t border-[var(--nf-panel-hair)] pt-md">
            {checkIn && checkOut && (
              <div className="flex items-start justify-between gap-md">
                <dt className={TYPE.rowMeta}>{t.catalogue.stays.checkIn}</dt>
                <dd className={`text-right ${TYPE.rowTitle}`}>
                  <span className="nf-numeric">{stayDateLabel(checkIn) ?? checkIn}</span>
                </dd>
              </div>
            )}
            {checkIn && checkOut && (
              <div className="flex items-start justify-between gap-md">
                <dt className={TYPE.rowMeta}>{t.catalogue.stays.checkOut}</dt>
                <dd className={`text-right ${TYPE.rowTitle}`}>
                  <span className="nf-numeric">{stayDateLabel(checkOut) ?? checkOut}</span>
                </dd>
              </div>
            )}
            <div className="flex items-start justify-between gap-md">
              <dt className={TYPE.rowMeta}>{t.catalogue.stays.guests}</dt>
              <dd className={`text-right ${TYPE.rowTitle}`}>{copy.guests.replace("{count}", String(guests))}</dd>
            </div>
            <div className="flex items-start justify-between gap-md">
              {/* The catalogue's row label ("Per night"); stayDetail.perNight is the suffix after a price ("a night"). */}
              <dt className={TYPE.rowMeta}>{t.catalogue.card.perNight}</dt>
              <dd className={`text-right ${TYPE.rowTitle}`}>
                <Amount minorUnits={plan.rate_minor} locale={locale} />
              </dd>
            </div>
            {total !== null && nights !== null && (
              <div className="flex items-start justify-between gap-md border-t border-[var(--nf-panel-hair)] pt-xs">
                <dt className={TYPE.rowMeta}>{copy.totalFor.replace("{count}", String(nights))}</dt>
                <dd className="nf-numeric text-right nf-h4 text-[var(--nf-content-primary)]">
                  <Amount minorUnits={total} locale={locale} />
                </dd>
              </div>
            )}
          </dl>
          {cancelLine && total !== null && (
            <p className="nf-body mt-xs font-semibold text-[var(--nf-content-primary)]" data-testid="room-cancel-line">
              {cancelLine}
            </p>
          )}
        </Panel>
      )}

      {/* ROOM BOOKINGS 1: with rooms switched on, a priced pick is requested for real. */}
      {roomsOn && detail && room && plan && checkIn && checkOut && total !== null ? (
        session.state === "signed-in" ? (
          <RoomRequestForm
            stayId={detail.accommodation.id}
            roomTypeId={room.id}
            ratePlanId={plan.id}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            maxRooms={room.units_total}
            copy={{
              roomsLabel: t.checkout.roomsLabel,
              requestRoom: instantOn ? t.checkout.instantRoomAction : t.checkout.requestRoom,
              requestRoomBody: instantOn ? t.checkout.instantRoomBody : t.checkout.requestRoomBody,
              roomChoices: Array.from({ length: Math.min(10, room.units_total) }, (_, i) => plural(i + 1, t.counts.rooms, locale)),
            }}
          />
        ) : (
          <div className="mt-row">
            <ButtonLink
              href={withNext("/sign-in", returnHref("/checkout", new URLSearchParams(query as Record<string, string>).toString(), "list"))}
              variant="primary"
              size="lg"
            >
              {t.checkout.signInToRequestRoom}
            </ButtonLink>
          </div>
        )
      ) : (
      <ResultScreen
        state={detail ? "expired" : "missing"}
        mark={detail ? "calendar-check" : undefined}
        verdict={detail ? t.checkout.cannotHoldRoom : t.checkout.stayNotFound}
        consequence={
          detail
            ? t.checkout.cannotHoldRoomBody
            : t.checkout.stayNotFoundBody
        }
        actions={[
          { label: detail ? t.checkout.backToStay : t.stays.findStay, href: backHref, tone: "primary" },
          { label: t.stays.findStay, href: "/stays/search", tone: "quiet" },
        ]}
        data-testid="room-checkout-state"
      />
      )}

      <p className={`flex items-start gap-inline ${TYPE.caption}`}>
        {/* Advice, so a neutral glyph: the shield means an earned check (A9). */}
        <UiIcon name="info" size={ICON.inline} className="mt-3xs shrink-0" />
        <span>{t.checkout.onlyYourBooking}</span>
      </p>
      </div>
    </PageFrame>
  );
}
