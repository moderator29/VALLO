"use client";

import { useHostCopy } from "@/components/host/host-copy";
import { differs, useGuard, useHeld } from "../wizard-memory";
import { formatNumber } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { addAccommodationDraft, setAccommodationFacilities } from "@/lib/host/actions";
import { branchFor, pinFrom } from "@/lib/host/stays-setup";
import { AccommodationPhotoManager } from "../AccommodationPhotoManager";
import { FacilitiesPicker } from "../FacilitiesPicker";
import { StaysNote, StaysPlate } from "./StaysParts";
import type { StaysStepProps } from "./types";

/* A coordinate written into the field, six places (about 11cm), through the
   one number formatter. No grouping, so the field reads back as a number. */
const coordinateText = (value: number) =>
  formatNumber(value, "en", { minimumFractionDigits: 6, maximumFractionDigits: 6, useGrouping: false });

/**
 * FACILITIES AND PHOTOS. `GOVERNING-10` screen four, and the shortlet's twin
 * of it.
 *
 * THREE THINGS SHARE THIS STEP and only two of them are drawn. The render puts
 * the facility tiles and the photographs on one screen, which is what the first
 * two blocks are. The pin is the third and it is drawn nowhere in `GOVERNING-10`
 * or `GOVERNING-11`, while `missingFrom` refuses to submit a property without
 * it. Somewhere is where it had to go, and the screen that is already about
 * where a property is and what it looks like is the least wrong place. It is
 * said here rather than left for somebody to discover.
 *
 * THE UPLOADER APPEARS ONLY ONCE THE PROPERTY EXISTS, because a photograph
 * hangs on the property row: a drop target that could not name what it was
 * attaching to would fail on the server after the file had already gone up,
 * over a Nigerian mobile connection, which is the most expensive possible
 * moment to fail.
 */
export function FacilitiesStep({ draft, userId, pending, runAsync, setNotice, advance, goTo }: StaysStepProps & {
  userId: string;
}) {
  const hw = useHostCopy();
  const w = hw.stays;
  /* Held in the wizard: the ticked facilities and a typed pin survive Back,
     and the wizard asks before either is left unsaved. */
  const chosen = draft.accommodation?.facilities ?? [];
  const [picked, setPicked] = useHeld<string[]>("facilities", chosen);
  const [lat, setLat] = useHeld("lat", "");
  const [lng, setLng] = useHeld("lng", "");
  const facilitiesChanged = differs([...picked].sort(), [...chosen].sort());
  const pinTyped = lat.trim() !== "" || lng.trim() !== "";

  const locate = () => {
    if (!navigator.geolocation) {
      setNotice({ tone: "error", text: w.facilities.noLocation });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(coordinateText(position.coords.latitude));
        setLng(coordinateText(position.coords.longitude));
      },
      () => setNotice({ tone: "error", text: w.facilities.refused }),
    );
  };

  /* Null until both boxes hold a real coordinate, so a typo is caught here
     in words instead of reaching the server as NaN. */
  const pin = pinFrom(lat, lng);
  const typedBadPin = lat.trim() !== "" && lng.trim() !== "" && pin === null;

  const savePinAsync = async () => {
    if (!pin) {
      setNotice({ tone: "error", text: w.facilities.badPin });
      return false;
    }
    const saved = await runAsync(() =>
      addAccommodationDraft({
        name: draft.accommodation?.name ?? draft.name,
        latitude: pin.latitude,
        longitude: pin.longitude,
      }),
    );
    if (saved) {
      setLat("");
      setLng("");
      setNotice({ tone: "ok", text: w.facilities.pinSaved });
    }
    return saved;
  };
  const savePin = () => void savePinAsync();

  /* What "Save and go back" saves: the facilities if they changed, then the
     pin if one was typed. */
  const accommodationId = draft.accommodation?.id ?? null;
  const save = async () => {
    if (facilitiesChanged && accommodationId) {
      const saved = await runAsync(() => setAccommodationFacilities({ accommodationId, codes: picked }));
      if (!saved) return false;
    }
    if (pinTyped) return savePinAsync();
    return true;
  };
  useGuard("facilities", facilitiesChanged || pinTyped, save);

  if (!draft.accommodation) {
    /* A way out rather than an instruction: the property's own screen is a
       hotel's first or a shortlet's first, and this opens whichever it is. */
    return (
      <>
        <StaysNote>{w.facilities.saveFirst}</StaysNote>
        <Button
          variant="primary"
          size="lg"
          full
          leadingIcon="arrow-left"
          onClick={() => goTo(branchFor(draft.kind) === "shortlet" ? "place" : "hotel")}
        >
          {w.common.openProperty}
        </Button>
      </>
    );
  }

  return (
    <>
      <FacilitiesPicker
        accommodationId={draft.accommodation.id}
        chosen={draft.accommodation.facilities}
        picked={picked}
        onPick={setPicked}
      />

      <AccommodationPhotoManager
        accommodationId={draft.accommodation.id}
        userId={userId}
        photos={draft.accommodation.photos}
      />

      <StaysPlate
        label={hw.steps.pinLabel}
        note={
          draft.accommodation.hasPin
            ? w.facilities.pinOnRecord
            : w.facilities.pinRequired
        }
      >
        <div className="grid grid-cols-2 gap-[var(--nf-space-sm)]">
          <div>
            <label className="nf-stays-plate__label" htmlFor="stays-lat">
              {w.facilities.latitude}
            </label>
            <input
              id="stays-lat"
              className="nf-field nf-field--glass nf-stays-input"
              inputMode="decimal"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
            />
          </div>
          <div>
            <label className="nf-stays-plate__label" htmlFor="stays-lng">
              {w.facilities.longitude}
            </label>
            <input
              id="stays-lng"
              className="nf-field nf-field--glass nf-stays-input"
              inputMode="decimal"
              value={lng}
              onChange={(event) => setLng(event.target.value)}
            />
          </div>
        </div>
        {/*
          FOUR PIXELS OF HORIZONTAL OVERFLOW, AND THE SHOT IS THE EVIDENCE.
          `docs/design/proofs/imgc/g10-4-facilities-and-photos-390-{dark,light}.png`
          (in git history at `85c5471`) are 394 pixels wide against a 390 viewport. Every other shot in that
          folder is 390. Two buttons that will not shrink and a row that would
          not wrap: "Use my location" carries an icon and a three word label,
          "Save the pin" carries three more, and inside the plate's padding
          they do not fit a 390 screen.

          The section that filed those shots claimed `overflowX` was measured on
          all twenty-four and was zero everywhere. It was not measured; the
          claim has no artefact behind it, and two of the files contradict it.
          A measurement nobody took reads exactly like one that passed.
        */}
        <div className="mt-[var(--nf-space-sm)] flex flex-wrap gap-[var(--nf-space-xs)]">
          <Button variant="secondary" leadingIcon="location" onClick={locate} disabled={pending}>
            {w.facilities.useLocation}
          </Button>
          <Button
            variant="secondary"
            onClick={savePin}
            disabled={pending || pin === null}
            loading={pending}
          >
            {w.facilities.savePin}
          </Button>
        </div>
        {typedBadPin ? (
          <p className="nf-stays-plate__note" role="alert">
            {w.facilities.badPinHelp}
          </p>
        ) : null}
      </StaysPlate>

      <Button
        variant="primary"
        size="lg"
        full
        trailingIcon="chevron-right"
        onClick={async () => {
          if (await save()) advance();
        }}
        disabled={pending}
      >
        {w.common.continue}
      </Button>

      <StaysNote>
        {w.facilities.note}
      </StaysNote>
    </>
  );
}
