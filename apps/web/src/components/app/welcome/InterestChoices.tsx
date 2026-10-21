"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { DataSaverRow } from "@/components/app/account/DataSaverRow";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { ActionResult } from "@/lib/actions/envelope";
import {
  saveInterestsAction,
  skipInterests,
  type InterestsSaved,
} from "@/lib/interests/actions";
import type { Dictionary } from "@vallo/i18n/core";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/interests/model";
import { forgetFirstInterest } from "./first-run-seen";

/**
 * The one question worth asking at the door.
 *
 * ONE SCREEN, NOT A WIZARD, AND THAT IS THE DESIGN.
 *
 * There is exactly one thing the product can act on the moment somebody
 * arrives: which markets to put in front of them. A budget cannot be honoured
 * without a city, a city already has a screen that owns it, and a travel date
 * is a booking, not a preference. Every extra step would have collected an
 * answer nothing reads, which is the polite version of wasting somebody's time.
 * So there is no `SegmentedProgress` here: a progress bar over a single step is
 * a promise of four more.
 *
 * There is also no location picker. `/settings/place` owns where somebody is,
 * together with the local government it has to agree with, and the note in
 * `lib/profile/actions.ts` records what the last duplicate of that question
 * cost: a second, simpler picker that wrote the state's NAME into a column
 * holding its CODE, so every save was refused by the database and reported as a
 * generic failure.
 *
 * The cards are toggles, not radios: somebody looking for a shortlet this month
 * and a rental next year is one person with two answers. Selection is a ring
 * plus a fill tint off the brand token - the same treatment `Chip` settled on,
 * for the same reason, which is that a hairline glow is not a state change on a
 * phone in daylight.
 *
 * Nothing is saved until Continue. Skip saves nothing at all and never asks
 * again, which is what makes it a real skip rather than a "later".
 *
 * TWO MOUNTS, ONE COMPONENT.
 *
 * The same cards answer the same question on `/welcome` and on
 * `/settings/interests`, and they are the same component on purpose. A second
 * copy for the settings screen is how the two drift: the enum grows, one screen
 * gets the new card, and a person who edits their answer later silently loses
 * an option they were offered at the door. `mode` changes three things and
 * nothing else - where a save lands, what the primary button says, and whether
 * Skip is offered.
 *
 * Skip belongs to the first run only. Somebody who deliberately opened the
 * settings screen cannot "skip" a question they went looking for; the way to
 * state nothing there is to take every card off, which saves an empty list,
 * which is a real answer the schema already accepts.
 */
export function InterestChoices({
  initial,
  mode = "welcome",
  t,
  extra,
}: {
  initial: PropertyType[];
  /* The nine market names and every word around them. `INTEREST_COPY` in
     lib/interests/schema.ts stays as the English source the dictionary was
     written from, but nothing renders it now. */
  t: Dictionary;
  /** `welcome` is the first run. `settings` is somebody changing their mind. */
  mode?: "welcome" | "settings";
  /**
   * First run only: the optional asks the sign-up form no longer carries
   * (`ArrivalAsks`, A1), drawn above Continue. They save themselves; nothing
   * in them is read by this form's action.
   */
  extra?: ReactNode;
}) {
  const router = useRouter();
  const firstRun = mode === "welcome";
  const [chosen, setChosen] = useState<PropertyType[]>(initial);
  const [saved, setSaved] = useState(false);
  const [skipping, startSkip] = useTransition();
  const [skipError, setSkipError] = useState("");
  const [state, formAction, saving] = useActionState<
    ActionResult<InterestsSaved> | null,
    FormData
  >(saveInterestsAction, null);

  useEffect(() => {
    if (!state?.ok) return;
    /* Answered: the market a landing tile carried has done its job (V-18). */
    forgetFirstInterest();
    if (!firstRun) {
      /*
       * Settings stays where it is. Bouncing somebody to home the moment they
       * adjust a preference takes the screen away before they can see that it
       * worked, and takes away the chance to adjust it again.
       */
      setSaved(true);
      router.refresh();
      return;
    }
    /*
     * Home is rendered per request and reads this row, so a replace rather than
     * a push: the welcome screen is answered once and must not sit in the back
     * stack waiting to be walked into again.
     */
    router.replace("/home");
    router.refresh();
  }, [state, router, firstRun]);

  const toggle = (value: PropertyType) => {
    // Any change makes a previous confirmation stale, so it goes.
    setSaved(false);
    setChosen((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  };

  const onSkip = () => {
    setSkipError("");
    startSkip(async () => {
      const result = await skipInterests();
      if (!result.ok) {
        setSkipError(result.error);
        return;
      }
      forgetFirstInterest();
      router.replace("/home");
      router.refresh();
    });
  };

  const busy = saving || skipping;

  return (
    <form action={formAction} data-testid="welcome-form">
      {/*
        The choices ride as hidden inputs rather than as the cards' own
        checkboxes, so the control can be a real button with `aria-pressed` and
        a 44px target while the form still posts one repeated key. The server
        reads them with `getAll`.
      */}
      {chosen.map((value) => (
        <input key={value} type="hidden" name="interests" value={value} />
      ))}

      <div
        role="group"
        aria-label={t.interests.question}
        className="grid grid-cols-2 gap-sm sm:grid-cols-3"
      >
        {PROPERTY_TYPES.map((value) => {
          const selected = chosen.includes(value);

          return (
            <button
              key={value}
              type="button"
              data-testid={`interest-${value}`}
              aria-pressed={selected}
              disabled={busy}
              onClick={() => toggle(value)}
              /* The shared panel, and when chosen the shared selected state
                 (`.nf-interest[aria-pressed="true"]` in settings-rows.css reads
                 the `--nf-selected-*` tokens), as the console's selected row.
                 It was `.nf-card` with an inline flat tint. */
              className="nf-panel nf-panel--card nf-interest nf-tap relative flex min-h-[5.5rem] flex-col items-start justify-start gap-2xs p-md text-left transition-transform active:scale-[0.97] disabled:opacity-60"
            >
              {selected && (
                <UiIcon
                  name="verified"
                  size={16}
                  className="absolute right-3 top-3 shrink-0"
                />
              )}
              {/* A ring of light that spreads once from the tick when a card
                  is chosen (first run only: welcome.css scopes it to the
                  question; on settings it is an empty, unstyled span). */}
              {selected && <span className="nf-interest__burst" aria-hidden="true" />}
              <span className="pr-lg text-[length:var(--nf-text-body-sm)] font-semibold leading-tight text-[var(--nf-content-primary)]">
                {t.interests.markets[value]}
              </span>
              <span className="nf-interest__hint text-[length:var(--nf-text-overline)] leading-snug">
                {t.interests.hints[value]}
              </span>
            </button>
          );
        })}
      </div>

      {/* V-79: asked once, on the first run, where a person on a small
          bundle is deciding how the app will treat them. */}
      {firstRun && (
        <div className="mt-md">
          <DataSaverRow
            copy={{ ...t.platform.lite, label: t.platform.lite.welcomeTitle, sub: t.platform.lite.welcomeSub }}
          />
        </div>
      )}

      {firstRun && extra ? <div className="mt-md">{extra}</div> : null}

      {state && !state.ok && (
        <p
          role="alert"
          data-testid="welcome-error"
          className="nf-panel nf-panel--card mt-md block border-[color-mix(in_oklab,var(--nf-state-error)_55%,transparent)] px-md py-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-state-error)]"
        >
          {state.error}
        </p>
      )}

      {skipError && (
        <p
          role="alert"
          data-testid="welcome-skip-error"
          className="nf-panel nf-panel--card mt-md block border-[color-mix(in_oklab,var(--nf-state-error)_55%,transparent)] px-md py-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-state-error)]"
        >
          {skipError}
        </p>
      )}

      {saved && !firstRun && (
        <p
          role="status"
          data-testid="interests-saved"
          className="nf-panel nf-panel--card mt-md block border-[color-mix(in_oklab,var(--nf-state-success)_55%,transparent)] px-md py-sm text-center text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-state-success)]"
        >
          {chosen.length === 0
            ? t.interests.savedNothing
            : t.interests.savedSomething}
        </p>
      )}

      {/*
        The primary is enabled with nothing chosen, and saving an empty list is
        a real save: it states no intent and records that the question was
        asked, which on the first run is the same outcome as Skip and in
        settings is how somebody takes their answer back. A disabled primary
        button that gives no reason is how a screen becomes a dead end.
      */}
      <Button
        type="submit"
        variant="primary"
        full
        loading={saving}
        disabled={skipping}
        data-testid="welcome-save"
        className="mt-lg"
      >
        {firstRun ? t.common.continue : t.interests.save}
      </Button>

      {firstRun && (
        <Button
          type="button"
          variant="ghost"
          full
          onClick={onSkip}
          loading={skipping}
          disabled={saving}
          data-testid="welcome-skip"
          className="mt-xs"
        >
          {t.interests.skip}
        </Button>
      )}

      {/*
        Says exactly what the answer does and nothing more. On the first run it
        now also names the screen this can be changed on, which it could not do
        before that screen existed - the note it replaces recorded exactly that,
        and the rule it was keeping was never to promise a surface nobody had
        built.
      */}
      <p className="mt-md text-center text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
        {t.interests.note}
        {firstRun ? t.interests.noteFirstRun : ""}
      </p>
    </form>
  );
}
