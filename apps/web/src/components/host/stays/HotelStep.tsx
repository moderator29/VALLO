"use client";

import { useHostCopy } from "@/components/host/host-copy";
import { differs, useGuard, useHeld } from "../wizard-memory";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { addAccommodationDraft } from "@/lib/host/actions";
import { StaysHero, StaysNote, StaysPlate, StaysRow, StaysStepper } from "./StaysParts";
import type { StaysStepProps } from "./types";
import { countOf } from "@vallo/i18n/core";

/**
 * YOUR HOTEL. `GOVERNING-10` screen one, and `GOVERNING-09` screen four.
 *
 * WHAT WAS THERE. A step headed "The property" with a name box, a description
 * box, a star select, two time inputs, a rules textarea and a policy select,
 * all of them the platform's ordinary labelled field, none of them the drawn
 * screen. The render asks a hotelier five things and puts the hotel itself at
 * the top of the screen as a lit object, and it does not ask for a check-in
 * time on the same breath as the RC number.
 *
 * WHAT IS DRAWN AND WHAT IT IS WIRED TO, one by one, because three of the five
 * are not properties of the property at all:
 *
 *  - HOTEL NAME is `accommodations.name`, saved by `addAccommodationDraft`.
 *  - RC NUMBER is `businesses.cac_number`. It is the same answer the
 *    registration step asks for, shown here because the render shows it here,
 *    and saved through the same `saveHostDraft` the registration step uses.
 *    Two boxes, one column, and whichever is typed into last wins, which is
 *    the correct behaviour for one fact asked twice.
 *  - ADDRESS is the business's, asked in full on the business step. It is a
 *    ROW here and not a field: the render draws it with a pin and a chevron,
 *    which means "this is what you told us, open it to change it", and that is
 *    exactly what it does.
 *  - STAR RATING is `accommodations.star_rating`.
 *  - NUMBER OF ROOMS has no column anywhere in this database, and the note at
 *    the foot of the screen says what it actually does rather than pretending.
 *
 * THE ONE PLACE THE RENDER IS NOT FOLLOWED, and it is the star row's chevron.
 * `GOVERNING-10` draws a chevron at the right of the star rating, which means
 * a select. The stars ARE the control here, and a chevron beside them would be
 * an affordance that opens nothing. Everything else on the row, the five
 * marks, four lit and one hollow, the plate, the label, is the render.
 */
export function HotelStep({
  locale,
  draft,
  set,
  pending,
  fieldErrors,
  runAsync,
  saveTextAsync,
  setNotice,
  goTo,
  advance,
  expectedRooms,
  onExpectedRooms,
}: StaysStepProps & {
  /**
   * The total a hotelier states before any room type exists.
   *
   * IT IS THE WIZARD'S AND NOT THIS SCREEN'S, because the room types step is
   * where it is spent: the first room type is created with it. See the note at
   * the foot of the screen, which tells the host the same thing.
   */
  expectedRooms: number;
  onExpectedRooms(next: number): void;
}) {
  const hw = useHostCopy();
  const w = hw.stays;
  /* Held in the wizard, so Back and a jump along the path keep what is typed;
     the saved answer is what they start from and what "unsaved" is measured
     against. */
  const savedName = draft.accommodation?.name ?? draft.name ?? "";
  const savedStars = draft.accommodation?.starRating ?? null;
  const [name, setName] = useHeld("name", savedName);
  const [stars, setStars] = useHeld<number | null>("stars", savedStars);
  const save = () => runAsync(() => addAccommodationDraft({ name, starRating: stars }));
  useGuard("hotel", differs({ name, stars }, { name: savedName, stars: savedStars }), save);

  /* The rooms actually on sale, which is the sum of the room types. Until
     there is one, the number is the hotelier's own stated total. */
  const onSale = draft.roomTypes.reduce((total, room) => total + room.unitsTotal, 0);
  const rooms = draft.roomTypes.length > 0 ? onSale : expectedRooms;

  /* TWO LINES, AS DRAWN: the street, then where it is. The state joins the
     second line rather than taking a third, which is how the render writes
     "Plot 12, Admiralty Way / Lekki, Lagos" and how anybody writes an address
     on an envelope. */
  const addressLines = [draft.address, [draft.area, draft.city, draft.stateCode].filter(Boolean).join(", ")]
    .map((line) => line.trim())
    .filter(Boolean);

  const saveAndGo = async () => {
    if (!(await saveTextAsync())) return;
    if (!(await save())) return;
    setNotice({ tone: "ok", text: w.hotel.saved });
    advance();
  };

  return (
    <>
      <StaysHero mark="stays-hotel-palms" />

      <StaysPlate label={hw.steps.hotelName} htmlFor="stays-hotel-name">
        <input
          id="stays-hotel-name"
          className="nf-field nf-field--glass nf-stays-input"
          value={name}
          autoComplete="organization"
          onChange={(event) => setName(event.target.value)}
        />
      </StaysPlate>

      {/* ONLY A REGISTERED BUSINESS IS ASKED FOR ITS RC NUMBER. A guest house
          or serviced apartments let in somebody's own name take these screens
          too, have no registration step, and were being asked for a number
          they do not have under a label that did not say it was optional. */}
      {draft.hostType === "business" && (
        <StaysPlate label={hw.steps.rcNumber} htmlFor="stays-hotel-rc">
          <input
            id="stays-hotel-rc"
            className="nf-field nf-field--glass nf-stays-input"
            value={draft.cacNumber}
            inputMode="text"
            aria-invalid={fieldErrors.cacNumber ? true : undefined}
            onChange={(event) => set("cacNumber", event.target.value)}
          />
          {fieldErrors.cacNumber ? (
            <p className="nf-stays-plate__note" role="alert">
              {fieldErrors.cacNumber}
            </p>
          ) : null}
        </StaysPlate>
      )}

      <StaysPlate label={hw.steps.address}>
        <button
          type="button"
          onClick={() => goTo("business")}
          className="nf-stays-row w-full"
          aria-label={hw.steps.changeAddress}
        >
          <UiIcon name="location" size={20} className="shrink-0 text-[var(--nf-brand-secondary)]" />
          <span className="min-w-0 flex-1 text-left">
            {addressLines.length > 0 ? (
              addressLines.map((line) => (
                <span key={line} className="nf-stays-row__value block">
                  {line}
                </span>
              ))
            ) : (
              <span className="nf-stays-row__meta">{w.common.notGivenBusiness}</span>
            )}
          </span>
          <UiIcon name="chevron-right" size={20} className="shrink-0 text-[var(--nf-content-muted)]" />
        </button>
      </StaysPlate>

      <StaysPlate label={hw.steps.starRating}>
        <div
          role="radiogroup"
          aria-label={hw.steps.starRating}
          className="nf-stays-stars mt-[var(--nf-space-xs)]"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={countOf(n, "stars", locale)}
              onClick={() => setStars(stars === n ? null : n)}
              className="grid h-11 w-9 place-items-center"
            >
              <UiIcon name="star" size={28} filled={stars !== null && n <= stars} />
            </button>
          ))}
        </div>
        <p className="nf-stays-plate__note">
          {stars === null
            ? w.hotel.starsNone
            : w.hotel.starsClaimed}
        </p>
      </StaysPlate>

      <StaysPlate label={hw.steps.roomCount}>
        <StaysRow
          trailing={
            <StaysStepper
              label={hw.steps.roomsUnit}
              value={rooms}
              min={1}
              max={999}
              showValue={false}
              onChange={onExpectedRooms}
              disabled={draft.roomTypes.length > 0}
            />
          }
        >
          <span className="nf-stays-row__value text-[length:var(--nf-text-h4)] font-semibold">{rooms}</span>
        </StaysRow>
        <p className="nf-stays-plate__note">
          {draft.roomTypes.length > 0
            ? w.hotel.roomsTotal
            : w.hotel.roomsExpected}
        </p>
      </StaysPlate>

      <Button
        variant="primary"
        size="lg"
        full
        trailingIcon="chevron-right"
        onClick={() => void saveAndGo()}
        disabled={pending || name.trim().length < 2}
        loading={pending}
      >
        {w.common.continue}
      </Button>

      <StaysNote>
        {w.hotel.note}
      </StaysNote>
    </>
  );
}
