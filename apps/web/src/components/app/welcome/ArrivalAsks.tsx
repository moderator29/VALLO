"use client";

import { useState, useTransition } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { HEAR_ABOUT_OPTIONS } from "@/lib/auth/signup-options";
import { rememberHearAbout } from "@/lib/auth/arrival-asks";
import { updatePlace } from "@/lib/places/actions";
import { PlaceFields, type PlaceValues } from "@/components/app/place/PlaceFields";
import type { StateOption } from "@/lib/places/reference";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * WHAT THE SIGN-UP FORM NO LONGER ASKS (A1, 30 September).
 *
 * Sign up is one screen now; how somebody heard of Vallo and where they stay
 * are asked here, once the account exists, beside the interests question,
 * and both are optional. Each answer is saved the moment it is given (a tap
 * on a chip, a state or local government chosen), with a small "Saved"
 * beside it, so Continue and Skip on the question below mean exactly what
 * they did before and nothing here can hold them up.
 *
 *   How did you hear   one of the six listed answers, into the account's
 *                      own metadata (`rememberHearAbout`), where the old
 *                      form put it.
 *   Where you stay     the same pickers and the same `updatePlace` that
 *                      Settings > Place uses, so the codes and the pairing
 *                      rule are the database's, not a second copy.
 *
 * Only drawn for somebody the page could not find a place for, so a person
 * who answered on the old two-step form is not asked again.
 */
export function ArrivalAsks({
  t,
  states,
  askPlace,
  hearAbout: initialHearAbout,
}: {
  t: Dictionary;
  states: StateOption[];
  /** False when the profile already holds a state. */
  askPlace: boolean;
  /** The answer already on the account, if any. */
  hearAbout: string | null;
}) {
  const c = t.welcomeCards.firstRun.asks;
  const [heard, setHeard] = useState<string | null>(initialHearAbout);
  const [heardState, setHeardState] = useState<"idle" | "saved" | "failed">("idle");
  const [place, setPlace] = useState<PlaceValues>({ stateCode: "", lgaCode: "", occupationCode: "" });
  const [placeState, setPlaceState] = useState<"idle" | "saved" | "failed">("idle");
  const [, start] = useTransition();

  const chooseHeard = (value: string) => {
    setHeard(value);
    setHeardState("idle");
    start(async () => {
      try {
        const result = await rememberHearAbout(value);
        setHeardState(result.ok ? "saved" : "failed");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const changePlace = (next: PlaceValues) => {
    setPlace(next);
    setPlaceState("idle");
    if (!next.stateCode) return;
    start(async () => {
      try {
        const result = await updatePlace(next);
        setPlaceState(result.ok ? "saved" : "failed");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const status = (s: "idle" | "saved" | "failed", testId: string) =>
    s === "idle" ? null : (
      <span
        role="status"
        className={s === "saved" ? "nf-gs-asks__saved" : "nf-gs-asks__failed"}
        data-testid={testId}
      >
        {s === "saved" ? (
          <>
            <UiIcon name="check" size={14} />
            {c.saved}
          </>
        ) : (
          c.failed
        )}
      </span>
    );

  return (
    <section className="nf-gs-asks nf-panel nf-panel--card" aria-labelledby="gs-asks-title" data-testid="arrival-asks">
      <h2 id="gs-asks-title" className="nf-gs-asks__title">
        {c.title}
      </h2>
      <p className="nf-gs-asks__body">{c.body}</p>

      <div className="nf-gs-asks__group">
        <p className="nf-gs-asks__label" id="gs-asks-heard">
          {c.hearAbout}
          {status(heardState, "arrival-heard-status")}
        </p>
        <div className="nf-gs-asks__chips" role="group" aria-labelledby="gs-asks-heard">
          {HEAR_ABOUT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="nf-gs-asks__chip"
              aria-pressed={heard === option.value}
              onClick={() => chooseHeard(option.value)}
              data-testid={`arrival-heard-${option.labelKey}`}
            >
              {t.signUp.hearAbout[option.labelKey]}
            </button>
          ))}
        </div>
      </div>

      {askPlace ? (
        <div className="nf-gs-asks__group">
          <p className="nf-gs-asks__label">
            {c.place}
            {status(placeState, "arrival-place-status")}
          </p>
          <PlaceFields t={t} states={states} value={place} onChange={changePlace} />
        </div>
      ) : null}
    </section>
  );
}
