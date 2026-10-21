"use client";

import { useHostCopy } from "@/components/host/host-copy";
import { Chip } from "@/components/ui/Chip";
import type { ReactNode } from "react";
import { countOf, formatNumber } from "@vallo/i18n/core";
import { differs, useGuard, useHeld } from "../wizard-memory";
import {
  CANCEL_NOTICE_HOURS,
  DEFAULT_CANCEL_NOTICE_HOURS,
  DEFAULT_HOLD_MINUTES,
  HOLD_MINUTES,
  noticeWords,
} from "@/lib/host/cancellation-presets";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { setRestaurantProfileDraft } from "@/lib/host/actions";
import { CUISINES, PRICE_BANDS } from "@/lib/host/stays-setup";
import { StaysHero, StaysNote, StaysPlate, StaysTile, StaysTiles } from "./StaysParts";
import type { StaysStepProps } from "./types";

/**
 * YOUR RESTAURANT. `GOVERNING-11` screen three.
 *
 * WHAT WAS THERE. A group called "The venue" with the cuisines asked for as a
 * comma-separated string in a single text box, and a price band asked for as a
 * number. A restaurateur in Lekki typing `Nigerian, Continental` into a box
 * and hoping the comma was the right separator is how a facet column fills up
 * with `nigerian`, `Nigerian `, `Nigerian food` and ` continental`, and a
 * cuisine filter that can never group any of them.
 *
 * THE CHIPS FIX A DATA PROBLEM AND NOT A VISUAL ONE. `restaurant_profiles.
 * cuisines` is a free text array, so the six chips are an OFFER and not a
 * whitelist: a venue that is none of them can still say what it is, and that
 * is why the list lives in `lib/host/stays-setup.ts` beside the note that says
 * so. What the chips buy is that six restaurants serving the same food write
 * the same word.
 *
 * THE PRICE BAND IS FOUR MARKS AND NEVER A PRICE. `price_band` is an integer
 * one to four. No band on this screen carries a range in naira, because this
 * platform has never measured what a band costs in any Nigerian city and a
 * printed range would be an invented number on a screen a restaurateur would
 * reasonably believe.
 *
 * THE ADDRESS IS A ROW WITH A CHEVRON, as drawn, and it opens the business
 * step where the address was actually asked for. It is the restaurant twin of
 * the same row on `GOVERNING-10` screen one.
 */

export function RestaurantStep({
  draft,
  set,
  pending,
  runAsync,
  saveTextAsync,
  setNotice,
  goTo,
  advance,
  extra,
  locale,
}: StaysStepProps & {
  /**
   * What the wizard adds to this screen above its Continue: the venue's
   * photographs and the health permit attestation, both of which the
   * application needs before it can be sent.
   */
  extra?: ReactNode;
}) {
  const hw = useHostCopy();
  const w = hw.stays;
  /*
   * HELD IN THE WIZARD, so Back keeps the chips and the tiles, and measured
   * against what is on record so the wizard can ask before they are lost. The
   * hold and the notice are the restaurant's own table rules: a table on
   * Vallo is free to ask for, the restaurant confirms it when one is free and
   * the bill is paid at the restaurant, so these are requests to the guest
   * and never charges. Preset to the common answer (15 minutes, 2 hours).
   */
  const savedForm = {
    cuisines: draft.restaurant?.cuisines ?? [],
    band: draft.restaurant?.priceBand ?? null,
    hold: draft.restaurant?.holdMinutes ?? DEFAULT_HOLD_MINUTES,
    notice: draft.restaurant?.cancelNoticeHours ?? DEFAULT_CANCEL_NOTICE_HOURS,
  };
  const [form, setForm] = useHeld("form", savedForm);
  const { cuisines, band, hold, notice } = form;
  const setCuisines = (update: (current: string[]) => string[]) =>
    setForm((current) => ({ ...current, cuisines: update(current.cuisines) }));
  const setBand = (value: number) => setForm((current) => ({ ...current, band: value }));
  const setHold = (value: number) => setForm((current) => ({ ...current, hold: value }));
  const setNoticeHours = (value: number) => setForm((current) => ({ ...current, notice: value }));

  /* TWO LINES, AS DRAWN: the street, then where it is. The state joins the
     second line rather than taking a third, which is how the render writes
     "Plot 12, Admiralty Way / Lekki, Lagos" and how anybody writes an address
     on an envelope. */
  const addressLines = [draft.address, [draft.area, draft.city, draft.stateCode].filter(Boolean).join(", ")]
    .map((line) => line.trim())
    .filter(Boolean);

  /* Kept as a promise of its own so the answer says whether the table rules
     were kept: before `20261013090200_...` runs they cannot be. */
  let rulesKept = true;
  const saveProfile = () =>
    runAsync(async () => {
      const result = await setRestaurantProfileDraft({
        cuisines,
        priceBand: band,
        holdMinutes: hold as 10 | 15 | 20 | 30,
        cancelNoticeHours: notice as 1 | 2 | 4 | 24,
      });
      if (result.ok) rulesKept = result.data.rulesKept;
      return result;
    });
  useGuard("form", differs(form, savedForm), saveProfile);
  const saveAndGo = async () => {
    if (!(await saveTextAsync())) return;
    if (!(await saveProfile())) return;
    setNotice({
      tone: "ok",
      text: rulesKept
        ? w.restaurant.saved
        : w.restaurant.savedRulesNotKept,
    });
    advance();
  };

  return (
    <>
      <StaysHero mark="concierge-bell" inline>
        <div className="min-w-0">
          <p className="nf-stays-title mt-0">{w.restaurant.title}</p>
          <p className="nf-stays-hint">{w.restaurant.hint}</p>
        </div>
      </StaysHero>

      <StaysPlate label={hw.steps.restaurantName} htmlFor="stays-restaurant-name">
        <input
          id="stays-restaurant-name"
          className="nf-field nf-field--glass nf-stays-input"
          value={draft.name}
          autoComplete="organization"
          onChange={(event) => set("name", event.target.value)}
        />
      </StaysPlate>

      <StaysPlate label={hw.steps.cuisine}>
        <div className="nf-stays-chips" role="group" aria-label={hw.steps.cuisine}>
          {CUISINES.map((cuisine) => {
            const chosen = cuisines.includes(cuisine);
            return (
              <Chip
                key={cuisine}
                behaviour="filter"
                selected={chosen}
                onSelectedChange={() =>
                  setCuisines((current) =>
                    chosen ? current.filter((one) => one !== cuisine) : [...current, cuisine],
                  )
                }
              >
                {cuisine}
              </Chip>
            );
          })}
        </div>
        <p className="nf-stays-plate__note">
          {cuisines.length === 0
            ? w.restaurant.cuisinesNone
            : w.restaurant.cuisinesChosen.replace("{count}", formatNumber(cuisines.length, locale))}
        </p>
      </StaysPlate>

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

      <StaysPlate label={hw.steps.priceBand}>
        <StaysTiles label={hw.steps.priceBand} columns={4}>
          {PRICE_BANDS.map((option) => (
            <StaysTile
              key={option.value}
              title={option.marks}
              selected={band === option.value}
              onSelect={() => setBand(option.value)}
              variant="band"
            />
          ))}
        </StaysTiles>
        <p className="nf-stays-plate__note">
          {band === null
            ? w.restaurant.bandNone
            : (PRICE_BANDS.find((option) => option.value === band)?.meaning ?? "")}
        </p>
      </StaysPlate>

      {/* THE RESTAURANT'S OWN RULES FOR A TABLE, in plain presets. Guests read
          them before they ask for a table. */}
      <StaysPlate label={w.restaurant.holdLabel}>
        <StaysTiles label={w.restaurant.holdLabel} columns={4}>
          {HOLD_MINUTES.map((minutes) => (
            <StaysTile
              key={minutes}
              title={w.restaurant.minShort.replace("{count}", formatNumber(minutes, locale))}
              selected={hold === minutes}
              onSelect={() => setHold(minutes)}
              variant="band"
            />
          ))}
        </StaysTiles>
        <p className="nf-stays-plate__note">
          {w.restaurant.holdNote.replace("{minutes}", countOf(hold, "minutes", locale))}
        </p>
      </StaysPlate>

      <StaysPlate label={w.restaurant.noticeLabel}>
        <StaysTiles label={w.restaurant.noticeLabel} columns={4}>
          {CANCEL_NOTICE_HOURS.map((hours) => (
            <StaysTile
              key={hours}
              title={hours === 24 ? w.restaurant.oneDay : w.restaurant.hoursShort.replace("{count}", formatNumber(hours, locale))}
              selected={notice === hours}
              onSelect={() => setNoticeHours(hours)}
              variant="band"
            />
          ))}
        </StaysTiles>
        <p className="nf-stays-plate__note">
          {w.restaurant.noticeNote.replace("{notice}", noticeWords(notice, locale))}
        </p>
      </StaysPlate>

      {extra}

      {/* THE BAND IS ASKED FOR HERE AND REQUIRED HERE. The application cannot
          be sent without one (`missingFrom`), and letting Continue past an
          unanswered tile only moved the refusal to the last screen. */}
      <Button
        variant="primary"
        size="lg"
        full
        trailingIcon="chevron-right"
        onClick={() => void saveAndGo()}
        loading={pending}
        disabled={pending || draft.name.trim().length < 2 || band === null}
      >
        {w.common.continue}
      </Button>

      <StaysNote>
        {w.restaurant.note}
      </StaysNote>
    </>
  );
}
