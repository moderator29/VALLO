"use client";

import { useHostCopy } from "@/components/host/host-copy";
import { differs, useGuard, useHeld } from "../wizard-memory";
import { PolicyPicker } from "./PolicyPicker";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { addAccommodationDraft, syncPropertyRatesDraft } from "@/lib/host/actions";
import {
  HOUSE_RULES,
  clockLabel,
  halfHours,
  houseRulesOn,
  mergeHouseRules,
  type HouseRuleId,
} from "@/lib/host/stays-setup";
import { StaysGlyph, StaysNote } from "./StaysParts";
import type { StaysStepProps } from "./types";

/**
 * HOUSE RULES AND CANCELLATION. `GOVERNING-11` screen two.
 *
 * WHAT WAS THERE. A textarea labelled "House rules (optional)" and a select
 * labelled "Cancellation policy", both of them buried at the bottom of the
 * hotel's property step. A shortlet host's two most consequential answers, the
 * ones a guest argues about later, were the two least prominent controls in
 * the flow.
 *
 * THE FOUR TOGGLES WRITE SENTENCES, NOT BOOLEANS, and that is the whole design
 * of this screen. `accommodations.house_rules` is text that a guest reads on
 * the stay page. Four new boolean columns would have meant a second place
 * where rules live and a translation back into English at read time; instead
 * each switch owns one line, `lib/host/stays-setup.ts` owns the wording, and
 * `mergeHouseRules` keeps every line the host wrote themselves. A host who
 * typed "The generator runs from 7pm" on the old step still has it after
 * turning a switch off here, which is the failure this function exists to
 * prevent.
 *
 * THE THREE CANCELLATION TILES ARE THE PLATFORM'S OWN POLICIES AND NOT THREE
 * WORDS. `GOVERNING-11` draws Flexible, Moderate and Strict with a refund
 * sentence under each. Those sentences are `cancellation_policies.summary`,
 * written once in the database and read here, so nothing on this screen is a
 * refund promise typed into a component. Where the estate publishes fewer than
 * three policies, fewer than three tiles are drawn: an empty tile offering a
 * policy that does not exist would be the invented number rule broken in the
 * most expensive possible place.
 */
export function HouseRulesStep({
  draft,
  policies,
  locale,
  pending,
  runAsync,
  setNotice,
  advance,
}: StaysStepProps) {
  const hw = useHostCopy();
  const w = hw.stays;
  const existing = draft.accommodation?.houseRules ?? "";
  /* What is on record, and the form held in the wizard so Back keeps it. */
  const savedForm = {
    on:
      existing.trim().length > 0
        ? houseRulesOn(existing)
        : HOUSE_RULES.filter((rule) => rule.onByDefault).map((rule) => rule.id),
    checkIn: draft.accommodation?.checkInFrom || "14:00",
    checkOut: draft.accommodation?.checkOutBy || "11:00",
    policy: draft.accommodation?.cancellationPolicyId ?? "",
  };
  const [form, setForm] = useHeld("form", savedForm);
  const { on, checkIn, checkOut, policy } = form;
  const setOn = (update: (current: HouseRuleId[]) => HouseRuleId[]) =>
    setForm((current) => ({ ...current, on: update(current.on) }));
  const setCheckIn = (value: string) => setForm((current) => ({ ...current, checkIn: value }));
  const setCheckOut = (value: string) => setForm((current) => ({ ...current, checkOut: value }));
  const setPolicy = (value: string) => setForm((current) => ({ ...current, policy: value }));

  const times = halfHours();

  const save = () =>
    runAsync(async () => {
      const saved = await addAccommodationDraft({
        name: draft.accommodation?.name ?? draft.name,
        houseRules: mergeHouseRules(existing, on),
        checkInFrom: checkIn,
        checkOutBy: checkOut,
        ...(policy ? { cancellationPolicyId: policy } : {}),
      });
      if (!saved.ok) return saved;
      /* The policy and the place's nightly price make the one rate a guest
         books. Without this no shortlet ever had a rate, and the application
         could not be sent. */
      return syncPropertyRatesDraft();
    });
  useGuard("form", differs(form, savedForm), save);
  const saveAndGo = async () => {
    if (!(await save())) return;
    setNotice({ tone: "ok", text: w.rules.saved });
    advance();
  };

  return (
    <>
      <div className="flex flex-col gap-[var(--nf-space-xs)]">
        {HOUSE_RULES.map((rule) => {
          const lit = on.includes(rule.id);
          return (
            <div key={rule.id} className="nf-stays-rule">
              <StaysGlyph icon={rule.mark} />
              <span className="nf-stays-rule__label">{rule.label}</span>
              <Switch
                checked={lit}
                aria-label={rule.label}
                disabled={pending}
                onCheckedChange={(next) =>
                  setOn((current) =>
                    next ? [...current, rule.id] : current.filter((id) => id !== rule.id),
                  )
                }
              />
            </div>
          );
        })}
      </div>

      {/*
        TWO TIMES SIDE BY SIDE IN ONE PLATE, as drawn. They are half hours
        rather than a free time input because check-in is a half hour in every
        property anybody has ever stayed in, and a native select is the only
        control that gets a phone's own wheel.
      */}
      <section className="nf-stays-plate">
        <div className="grid grid-cols-2 gap-[var(--nf-space-md)]">
          <div>
            <label className="nf-stays-plate__label" htmlFor="stays-check-in">
              {w.rules.checkInTime}
            </label>
            <select
              id="stays-check-in"
              className="nf-field nf-field--glass nf-stays-select"
              value={checkIn}
              disabled={pending}
              onChange={(event) => setCheckIn(event.target.value)}
            >
              {times.map((time) => (
                <option key={time} value={time}>
                  {clockLabel(time)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="nf-stays-plate__label" htmlFor="stays-check-out">
              {w.rules.checkOutTime}
            </label>
            <select
              id="stays-check-out"
              className="nf-field nf-field--glass nf-stays-select"
              value={checkOut}
              disabled={pending}
              onChange={(event) => setCheckOut(event.target.value)}
            >
              {times.map((time) => (
                <option key={time} value={time}>
                  {clockLabel(time)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* THE PRESETS, Flexible to Strict, with each one's refund rules
          printed in plain words from its own tiers: the words a guest reads
          on the stay page and at checkout. */}
      <PolicyPicker
        policies={policies}
        chosen={policy}
        onChoose={setPolicy}
        locale={locale}
        label={hw.steps.cancellationPolicy}
        disabled={pending}
        checkInFrom={checkIn}
      />

      {/* A POLICY IS REQUIRED TO GO ON, as the plate above already says. The
          place's one rate is made from it, and a shortlet with no rate cannot
          be sent. Where the estate publishes none there is nothing to pick,
          so the host is not held here by a question nobody can answer. */}
      <Button
        variant="primary"
        size="lg"
        full
        trailingIcon="chevron-right"
        onClick={() => void saveAndGo()}
        loading={pending}
        disabled={pending || (policies.length > 0 && !policy)}
      >
        {w.common.continue}
      </Button>

      <StaysNote>
        {w.rules.note}
      </StaysNote>
    </>
  );
}
