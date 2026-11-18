"use client";

import type { Dictionary, Locale } from "@vallo/i18n/core";
import { countOf, formatNumber } from "@vallo/i18n/core";
import type { ReactNode } from "react";
import { Amount } from "@/components/ui/Amount";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { StatusPill } from "@/components/ui/StatusPill";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TYPE } from "@/components/app/Screen";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { PhotoViewerProvider, usePhotoViewer } from "@/components/app/listing/PhotoViewer";
import { feedback } from "@/lib/ui/feedback";
import {
  reserveHref,
  MEAL_PLAN_KEY,
  ROOM_CATEGORY_KEY,
  orderedRooms,
  planAcceptsNights,
  ratePlanTotalMinor,
  type StayDetail,
  type StayRatePlan,
} from "./detail-model";
import { useStayPick } from "./StayPick";
import "./stay-detail.css";

/**
 * THE ROOMS AND THEIR RATES, AS AN INSTANT BOOKING (D73, 7 October 2026).
 *
 * A fixed-price stay books the way a hotel booking API does: pick a room and a
 * rate, see the total, book and pay. So the rates are no longer behind a tap
 * and a sheet. Each room is a header row (name, who it sleeps, its size) and
 * under it every rate it offers is a clear card: the rate's name, what it
 * includes, its cancellation policy in the policy's own words, the nightly
 * price and, once dates are picked, the total for them. A card is a radio:
 * choosing one moves the cost card and the anchored "Book and pay" to it
 * (`StayPick`). The page starts on the rate Book now always chose.
 *
 * Still one list of like things, the rule the rows were written to: rooms are
 * one boxed group, rates are rows of cards inside it, never a wall of
 * unrelated tiles. A rate that cannot take these nights says why and cannot be
 * chosen. Without dates nothing can be chosen, because there is no total to
 * book yet; the cards still show every rate and price.
 */

type StaysCopy = Dictionary["stayDetail"];

/*
 * `ReserveBase` and `reserveHref` live in `detail-model.ts` (a "use client"
 * export cannot be called from the server face). Re-exported here so every
 * existing call site keeps working and there is one definition.
 */
export type { ReserveBase } from "./detail-model";
export { reserveHref };

export function RoomTypes({
  detail,
  guests,
  nights,
  locale,
  copy,
}: {
  detail: StayDetail;
  guests: number;
  nights: number | null;
  locale: Locale;
  copy: StaysCopy;
}) {
  const ctx = useStayPick();
  const rooms = orderedRooms(detail, guests);
  const datesPicked = nights !== null && nights > 0;

  return (
    <div className="nf-rooms" role={datesPicked ? "radiogroup" : undefined} aria-label={copy.roomsTitle}>
      {rooms.map((room) => {
        const fits = room.sleeps >= guests;
        const photos = room.photos ?? [];
        return (
          <RoomPhotos key={room.id} name={room.name} photos={photos.map((photo) => photo.url)}>
          <section className="nf-rooms__room" aria-label={room.name}>
            {/* THE ROOM'S OWN PHOTOGRAPHS, when it has any (`room_type_photos`):
                the cover above the room, which opens the room's photographs in
                the same viewer the stay's hero uses. A room with none is drawn
                exactly as before. */}
            {photos[0] ? (
              <RoomCover name={room.name} cover={photos[0].url} count={photos.length} locale={locale} copy={copy} />
            ) : null}
            <div className="nf-rooms__head">
              <IconPlate size="md">
                <UiIcon name="bed" size={ICON_PLATE_GLYPH.md} />
              </IconPlate>
              <span className="min-w-0 flex-1">
                <span className={`block ${TYPE.rowTitle}`}>{room.name}</span>
                <span className={`mt-3xs block ${TYPE.rowMeta}`}>
                  {copy.category[ROOM_CATEGORY_KEY[room.category]]}
                  {" · "}
                  {copy.sleeps.replace("{count}", formatNumber(room.sleeps, locale))}
                  {room.sizeSqm ? ` · ${formatNumber(room.sizeSqm, locale)} m²` : ""}
                </span>
                {room.description ? <span className={`mt-3xs block ${TYPE.rowMeta}`}>{room.description}</span> : null}
                {photos.length > 1 ? <RoomPhotosLink count={photos.length} locale={locale} copy={copy} /> : null}
              </span>
              {!fits && <StatusPill tone="neutral">{copy.tooSmall}</StatusPill>}
            </div>

            {room.ratePlans.length === 0 ? (
              <p className={`nf-rooms__none ${TYPE.rowMeta}`}>{copy.noRatesYet}</p>
            ) : (
              <ul className="nf-rooms__rates">
                {room.ratePlans.map((plan) => (
                  <li key={plan.id}>
                    <RateCard
                      plan={plan}
                      nights={nights}
                      locale={locale}
                      copy={copy}
                      selected={ctx?.pick?.roomId === room.id && ctx.pick.planId === plan.id}
                      onChoose={
                        datesPicked && ctx
                          ? () => {
                              feedback("select");
                              ctx.setPick({ roomId: room.id, planId: plan.id });
                            }
                          : null
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          </RoomPhotos>
        );
      })}
    </div>
  );
}

/**
 * A room's own viewer. Nested under the stay's, so inside this room "open"
 * shows THIS room's photographs and nothing else; a room with none adds no
 * provider, and the stay's own viewer is untouched.
 */
function RoomPhotos({ name, photos, children }: { name: string; photos: string[]; children: ReactNode }) {
  if (photos.length === 0) return <>{children}</>;
  return (
    <PhotoViewerProvider title={name} photos={photos} hue={0} kind="hotel">
      {children}
    </PhotoViewerProvider>
  );
}

function RoomCover({
  name,
  cover,
  count,
  locale,
  copy,
}: {
  name: string;
  cover: string;
  count: number;
  locale: Locale;
  copy: StaysCopy;
}) {
  const viewer = usePhotoViewer();
  return (
    <button
      type="button"
      className="nf-tap block w-full"
      aria-label={copy.roomPhotosOpen.replace("{photos}", countOf(count, "photos", locale)).replace("{room}", name)}
      onClick={(event) => viewer?.open(0, event.currentTarget.getBoundingClientRect())}
      data-testid="room-cover"
    >
      <RemoteImage
        src={cover}
        alt=""
        width={640}
        height={360}
        sizes="(min-width: 768px) 480px, 92vw"
        className="h-40 w-full rounded-md border border-[var(--nf-border-subtle)] object-cover sm:h-48"
      />
    </button>
  );
}

function RoomPhotosLink({ count, locale, copy }: { count: number; locale: Locale; copy: StaysCopy }) {
  const viewer = usePhotoViewer();
  return (
    <button
      type="button"
      className="nf-tap mt-3xs block w-fit font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
      /* No origin: a line of text is not a photograph to grow out of, so the
         viewer fades up as it does for any opener without one. */
      onClick={() => viewer?.open(0)}
    >
      {copy.roomPhotosLink.replace("{photos}", countOf(count, "photos", locale))}
    </button>
  );
}

function RateCard({
  plan,
  nights,
  locale,
  copy,
  selected,
  onChoose,
}: {
  plan: StayRatePlan;
  nights: number | null;
  locale: Locale;
  copy: StaysCopy;
  selected: boolean;
  /** Null when nothing can be chosen yet (no dates). */
  onChoose: (() => void) | null;
}) {
  const total = ratePlanTotalMinor(plan, nights);
  const accepts = planAcceptsNights(plan, nights);
  const refusal =
    accepts || nights === null
      ? null
      : nights < plan.minStayNights
        ? copy.minStay.replace("{count}", formatNumber(plan.minStayNights, locale))
        : copy.maxStay.replace("{count}", formatNumber(plan.maxStayNights ?? 0, locale));
  const choosable = onChoose !== null && refusal === null && total !== null;
  const meal = copy.meal[MEAL_PLAN_KEY[plan.mealPlan]];

  const body = (
    <>
      <span className="nf-rate__main">
        <span className={`block ${TYPE.rowTitle}`}>{plan.name}</span>
        {/* What the rate includes, unless the rate is already named for it
            ("Room only" over "Room only" says one thing twice). */}
        {meal.toLowerCase() !== plan.name.trim().toLowerCase() ? (
          <span className={`mt-3xs block ${TYPE.rowMeta}`}>{meal}</span>
        ) : null}
        {/* The cancellation policy in its own words, from the policy's summary
            column. Not paraphrased: a refund rule a screen rewrote is a refund
            rule nobody can be held to. */}
        {plan.policy ? (
          <span className={`nf-rate__policy ${TYPE.rowMeta}`} data-free={plan.policy.freeUntilHours !== null || undefined}>
            <UiIcon name="verified" size={14} className="mt-3xs shrink-0" />
            <span className="min-w-0">{plan.policy.summary}</span>
          </span>
        ) : null}
        {refusal ? (
          <span role="status" className={`mt-2xs block ${TYPE.rowMeta}`}>
            {refusal}
          </span>
        ) : null}
      </span>
      <span className="nf-rate__price">
        <span className="nf-numeric block font-semibold text-[var(--nf-content-primary)]">
          <Amount minorUnits={plan.rateMinor} locale={locale} />
        </span>
        <span className={`block ${TYPE.caption}`}>{copy.perNight}</span>
        {total !== null && nights !== null && refusal === null ? (
          <span className="nf-rate__total nf-numeric">
            <Amount minorUnits={total} locale={locale} />
            <span className={`block ${TYPE.caption}`}>{copy.totalFor.replace("{count}", formatNumber(nights, locale))}</span>
          </span>
        ) : null}
      </span>
      {onChoose !== null ? (
        <span className="nf-rate__check" aria-hidden="true" data-on={selected || undefined}>
          {selected ? <UiIcon name="check" size={14} /> : null}
        </span>
      ) : null}
    </>
  );

  if (onChoose === null) {
    return (
      <div className="nf-rate" data-testid="rate-card">
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!choosable}
      onClick={choosable ? onChoose : undefined}
      className="nf-rate nf-rate--choice"
      data-selected={selected || undefined}
      data-testid="rate-card"
    >
      {body}
    </button>
  );
}
