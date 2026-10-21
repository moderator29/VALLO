"use client";

import { useHostCopy } from "@/components/host/host-copy";
import { useGuard, useHeld } from "../wizard-memory";
import { PolicyPicker } from "./PolicyPicker";
import { countOf, formatMoney, formatNumber } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { addAccommodationDraft, addRatePlanDraft, syncPropertyRatesDraft } from "@/lib/host/actions";
import { MEAL_PLANS, mealPlanLabel } from "@/lib/host/stays-setup";
import { StaysNote, StaysRow, StaysTile, StaysTiles } from "./StaysParts";
import type { StaysStepProps } from "./types";

/**
 * RATES. `GOVERNING-10` screen three.
 *
 * WHAT WAS THERE. A group headed "Its first rate" with a name box, a meals
 * select and a policy select, attached to the room type form, and no way at
 * all to see a rate once it had been saved. A hotel with two room types and
 * four rates could not read any of them back.
 *
 * THE DRAWN SCREEN IS A SCREEN ABOUT MONEY, so this one is too: a card per
 * room type, and inside it the nightly price of every plan that room is sold
 * on, in a list with a hairline between the rows. Every figure comes out of
 * `rate_plans.rate_minor`, which is integer kobo, and every figure is printed
 * by `formatMoney` and by nothing else.
 *
 * THE THUMBNAIL IS THE PROPERTY'S AND THE CODE SAYS SO. The render draws a
 * photograph of the room. `room_types` has no photographs: the only stay
 * imagery this database holds hangs on the accommodation. The property's cover
 * stands in where there is one, and the room's glass mark where there is not,
 * because inventing a picture of a room nobody has photographed is worse than
 * drawing a mark.
 *
 * THE CANCELLATION BLOCK IS DRAWN ONCE AND THE RENDER DRAWS IT PER CARD, which
 * is the one deliberate departure on this screen. `accommodations.
 * cancellation_policy_id` is a property-level column and the render's card is
 * the only room type it draws, so per card and once are the same picture there
 * and not here. Four copies of one control, all of them setting the same
 * column, is a control that lies about its own scope.
 *
 * FREE CANCELLATION IS NOT A BOOLEAN WE INVENTED. `cancellation_policies.
 * is_free_until_hours` is null when a policy is never free and a number of
 * hours when it is. The switch picks between those two sets and the row under
 * it picks which of the free ones, so the words on the screen are the words in
 * the column.
 */
export function RatesStep({
  draft,
  policies,
  locale,
  pending,
  fieldErrors,
  run,
  runAsync,
  setNotice,
  proceed,
  goTo,
}: StaysStepProps) {
  const hw = useHostCopy();
  const w = hw.stays;
  const cover = draft.accommodation?.photos[0]?.url ?? null;
  const chosen =
    policies.find((policy) => policy.id === draft.accommodation?.cancellationPolicyId) ?? null;

  const setPolicy = (id: string, said: string) =>
    run(
      async () => {
        const saved = await addAccommodationDraft({
          name: draft.accommodation?.name ?? draft.name,
          cancellationPolicyId: id,
        });
        if (!saved.ok) return saved;
        /* The note at the foot says the policy applies to every room. A
           booking reads the policy on the RATE, so every rate is moved onto
           the one just chosen, including any added before it was. */
        return syncPropertyRatesDraft();
      },
      () => setNotice({ tone: "ok", text: said }),
    );

  if (draft.roomTypes.length === 0) {
    return (
      <>
        <StaysNote>
          {w.rates.nothingYet}
        </StaysNote>
        <Button variant="primary" size="lg" full leadingIcon="arrow-left" onClick={() => goTo("room-types")}>
          {w.rates.addRoomType}
        </Button>
      </>
    );
  }

  return (
    <>
      {draft.roomTypes.map((room) => (
        <article key={room.id} className="nf-stays-card">
          <div className="nf-stays-card__head">
            <span className="nf-stays-thumb">
              {cover ? (
                /* eslint-disable-next-line @next/next/no-img-element -- a storage
                   URL on a surface that is never indexed and never prerendered;
                   the optimiser would proxy it for no gain. */
                <img src={cover} alt="" />
              ) : (
                <UiIcon name="bed" size={24} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="nf-stays-card__title block">{room.name}</span>
              <span className="nf-stays-row__meta">
                {w.rates.sleeps.replace("{rooms}", countOf(room.unitsTotal, "rooms", locale)).replace("{count}", formatNumber(room.sleeps, locale))}
              </span>
            </span>
          </div>

          {room.rates.length > 0 ? (
            <div className="nf-stays-list">
              {room.rates.map((rate) => (
                <StaysRow
                  key={rate.id}
                  trailing={
                    <span className="nf-stays-price">
                      {formatMoney(rate.rateMinor, locale)}
                      <span className="nf-stays-price__unit">{w.rates.perNight}</span>
                    </span>
                  }
                >
                  <span className="nf-stays-row__value">{mealPlanLabel(rate.mealPlan)}</span>
                </StaysRow>
              ))}
            </div>
          ) : (
            <p className="nf-stays-plate__note">
              {w.rates.noRate}
            </p>
          )}

          <RateEditor
            roomTypeId={room.id}
            baseRateMinor={room.baseRateMinor}
            taken={room.rates.map((rate) => rate.mealPlan)}
            policyId={chosen?.id ?? ""}
            locale={locale}
            pending={pending}
            fieldErrors={fieldErrors}
            runAsync={runAsync}
            setNotice={setNotice}
          />
        </article>
      ))}

      {/* FLEXIBLE, MODERATE, FIRM OR STRICT, each with its refund rules in
          plain words. It used to be a "Free cancellation" switch and a
          window select, which could not say what happens after the window. */}
      <PolicyPicker
        policies={policies}
        chosen={chosen?.id ?? ""}
        onChoose={(id) => setPolicy(id, w.rates.policySaved)}
        locale={locale}
        label={hw.steps.cancellationPolicy}
        disabled={pending}
        checkInFrom={draft.accommodation?.checkInFrom ?? null}
      />

      <Button
        variant="primary"
        size="lg"
        full
        trailingIcon="chevron-right"
        onClick={proceed}
        disabled={pending || !chosen}
      >
        {w.common.continue}
      </Button>

      <StaysNote>
        {chosen
          ? w.rates.policyNote
          : w.rates.choosePolicy}
      </StaysNote>
    </>
  );
}

/**
 * ADD ONE RATE TO ONE ROOM.
 *
 * The meal plans already sold on this room are not offered again: a room
 * cannot have two room-only rates, and letting somebody create one only to
 * meet a unique-index refusal they cannot act on is the failure this whole
 * build keeps finding. When all four are taken the editor says so and draws
 * nothing.
 */
function RateEditor({
  roomTypeId,
  baseRateMinor,
  taken,
  policyId,
  locale,
  pending,
  fieldErrors,
  runAsync,
  setNotice,
}: {
  roomTypeId: string;
  baseRateMinor: number;
  taken: string[];
  policyId: string;
  locale: StaysStepProps["locale"];
  pending: boolean;
  fieldErrors: Record<string, string>;
  runAsync: StaysStepProps["runAsync"];
  setNotice: StaysStepProps["setNotice"];
}) {
  const hw = useHostCopy();
  const w = hw.stays;
  const open = MEAL_PLANS.filter((plan) => !taken.includes(plan.id));
  /* Held in the wizard and guarded: a price typed for a rate and not saved is
     asked about before the host leaves the screen. */
  const blank = { adding: false, plan: open[0]?.id ?? "room_only", naira: "" };
  const [form, setForm] = useHeld(`rate:${roomTypeId}`, blank);
  const { adding, plan, naira } = form;
  const setAdding = (value: boolean) => setForm((current) => ({ ...current, adding: value }));
  const setPlan = (value: string) => setForm((current) => ({ ...current, plan: value as typeof blank.plan }));
  const setNaira = (value: string) => setForm((current) => ({ ...current, naira: value }));

  /* Naira typed in a box to integer kobo, once, at the boundary. The room's
     own base rate stands in when the box is empty, because that is a figure
     the host has already given rather than one this screen made up. */
  const typed = Number.parseFloat(naira.replace(/[^0-9.]/g, ""));
  const kobo =
    Number.isFinite(typed) && typed > 0 ? Math.round(typed * 100) : naira.trim() ? 0 : baseRateMinor;

  const save = async () => {
    if (kobo <= 0 || !policyId) {
      setNotice({ tone: "error", text: w.rates.incomplete });
      return false;
    }
    const saved = await runAsync(() =>
      addRatePlanDraft({
        roomTypeId,
        name: mealPlanLabel(plan),
        mealPlan: plan as "room_only" | "breakfast" | "half_board" | "full_board",
        cancellationPolicyId: policyId,
        rateMinor: kobo,
      }),
    );
    if (saved) {
      setNotice({ tone: "ok", text: w.rates.priced.replace("{plan}", mealPlanLabel(plan)) });
      setForm(blank);
    }
    return saved;
  };
  useGuard(`rate:${roomTypeId}`, adding && naira.trim().length > 0, save);

  if (open.length === 0) {
    return (
      <p className="nf-stays-plate__note">{w.rates.allPriced}</p>
    );
  }

  if (!adding) {
    return (
      <button
        type="button"
        className="nf-stays-row w-full"
        onClick={() => setAdding(true)}
        disabled={pending}
      >
        <span className="nf-stays-glyph">
          <UiIcon name="plus" size={16} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="nf-stays-row__value">{w.rates.addRate}</span>
        </span>
        <UiIcon name="chevron-right" size={20} className="shrink-0 text-[var(--nf-content-muted)]" />
      </button>
    );
  }

  return (
    <div className="mt-[var(--nf-space-sm)]">
      <StaysTiles label={hw.steps.mealPlan} columns={2}>
        {open.map((option) => (
          <StaysTile
            key={option.id}
            title={option.label}
            meaning={option.meaning}
            selected={plan === option.id}
            onSelect={() => setPlan(option.id)}
            variant="text"
          />
        ))}
      </StaysTiles>

      <label className="nf-stays-plate__label mt-[var(--nf-space-sm)] block" htmlFor={`rate-${roomTypeId}`}>
        {w.rates.nightlyPrice}
      </label>
      <input
        id={`rate-${roomTypeId}`}
        className="nf-field nf-field--glass nf-stays-input"
        inputMode="decimal"
        value={naira}
        placeholder={String(Math.round(baseRateMinor / 100))}
        aria-invalid={fieldErrors.rateMinor ? true : undefined}
        onChange={(event) => setNaira(event.target.value)}
      />
      <p className="nf-stays-plate__note">
        {kobo > 0 ? w.common.storedPerNight.replace("{amount}", formatMoney(kobo, locale)) : w.rates.enterPrice}
      </p>

      <div className="mt-[var(--nf-space-sm)] flex flex-wrap gap-[var(--nf-space-xs)]">
        <Button variant="secondary" size="lg" onClick={() => setForm(blank)} disabled={pending}>
          {w.common.cancel}
        </Button>
        <Button
          variant="primary"
          size="lg"
          full
          loading={pending}
          disabled={pending || kobo <= 0 || !policyId}
          onClick={() => void save()}
        >
          {w.rates.saveRate}
        </Button>
      </div>
    </div>
  );
}
