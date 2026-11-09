"use client";

import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import { TERMS_VERSION } from "@/lib/legal/versions";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * The tick that turns a notice into an acceptance.
 *
 * WHAT WAS THERE BEFORE. "By continuing you agree to our Terms and Privacy
 * Policy", printed under the button. Nobody agreed to anything; they were
 * told, afterwards, that they had. There was no record of it, no version
 * against it, and the Community Rules did not exist to be agreed to.
 *
 * Apple's guideline 1.2 asks in its published text for four precautions and
 * says nothing about an agreement. The requirement for one, and for the words
 * about objectionable content, comes from the rejection message App Review
 * sends rather than from the guidelines page; that is recorded honestly in
 * `lib/legal/eula.tsx`. Either way, a marketplace where two strangers arrange
 * to meet at a property should be able to say what somebody agreed to and
 * when, so this is worth having on its own terms.
 *
 * WHAT THIS COMPONENT IS AND IS NOT. It is the control and the hidden version
 * field. It is NOT the enforcement: the form it sits in refuses to submit
 * until it is ticked, and the server writes the receipt.
 *
 * THE COMMENT HERE USED TO BE WRONG, AND IT WAS WRONG IN THE MOST EXPENSIVE
 * DIRECTION. It said `public.profiles.terms_accepted_at` was written by the
 * sign-up trigger when a version arrived with the metadata. Measured against
 * the live database on 22 September 2026: `public.profiles` has no
 * `terms_accepted_at` column and no `terms_version` column, and
 * `handle_new_user` does not mention terms at all. The hidden field below was
 * submitted, carried into the auth metadata, and dropped. NOBODY'S ACCEPTANCE
 * HAD EVER BEEN RECORDED, while three comments and a test said it had.
 *
 * It is recorded now, in `public.terms_acceptances`, written by the server
 * through `lib/legal/acceptance.ts` at the moment the account is created.
 */

/**
 * Re-exported so the tick box and its hidden field keep one import.
 *
 * The constant itself moved to `lib/legal/versions.ts` when the acceptance was
 * given a table: a version string that two files can each declare is a version
 * string that will eventually disagree with itself, and this one already had a
 * second declaration by the time it was looked for.
 */
export { TERMS_VERSION };

export function AcceptTerms({
  t,
  accepted,
  onChange,
  showError,
  adult,
  onAdultChange,
  showAdultError,
}: {
  t: Dictionary;
  accepted: boolean;
  onChange: (next: boolean) => void;
  /** True once a submit has been refused for want of the tick. */
  showError: boolean;
  /** STORE-19: the 18-or-over tick, a separate statement from the agreement. */
  adult: boolean;
  onAdultChange: (next: boolean) => void;
  showAdultError: boolean;
}) {
  return (
    <div className="mt-md text-left">
      {/* `nf-tap` makes each row a 44px target without moving it (F-10): the
          20px box alone was too small to hit reliably, and the label is the
          control, so a tap anywhere on the expanded row toggles it. */}
      <label className="nf-tap mb-sm flex cursor-pointer items-start gap-sm">
        <input
          type="checkbox"
          name="ageConfirmed"
          value="18+"
          data-testid="age-confirmed"
          checked={adult}
          onChange={(e) => onAdultChange(e.target.checked)}
          aria-describedby={showAdultError ? "age-confirmed-error" : undefined}
          aria-invalid={showAdultError ? true : undefined}
          className="mt-3xs h-5 w-5 shrink-0 accent-[var(--nf-brand-primary)]"
        />
        <span className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {t.safety.ageLabel}
        </span>
      </label>
      {/* The box keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
      <FieldProblem id="age-confirmed-error" message={showAdultError ? t.safety.ageRequired : null} />
      <label className="nf-tap flex cursor-pointer items-start gap-sm">
        <input
          type="checkbox"
          name="acceptTerms"
          data-testid="accept-terms"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={showError ? "accept-terms-error" : undefined}
          aria-invalid={showError ? true : undefined}
          className="mt-3xs h-5 w-5 shrink-0 accent-[var(--nf-brand-primary)]"
        />
        <span className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {t.safety.acceptLabel}
        </span>
      </label>

      {/* The documents themselves, as three links rather than three links
          buried inside the sentence, so the sentence stays translatable as one
          sentence in all four locales. */}
      <p className="mt-2xs pl-xl text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
        {t.safety.acceptRead}{" "}
        <Link href="/terms" className="nf-tap underline underline-offset-4">
          {t.safety.termsLink}
        </Link>
        {", "}
        <Link href="/privacy" className="nf-tap underline underline-offset-4">
          {t.safety.privacyLink}
        </Link>
        {", "}
        <Link href="/eula" className="nf-tap underline underline-offset-4">
          {t.safety.rulesLink}
        </Link>
        {", "}
        <Link href="/community" className="nf-tap underline underline-offset-4">
          {t.safety.communityLink}
        </Link>
      </p>

      {/* NEWS AND UPDATES, UNTICKED BY DEFAULT (NDPR, 8 November 2026).
          Uncontrolled on purpose: it starts unticked and the person can tick
          it. The hidden `marketingAsked` marks that this form showed the box,
          so the server can tell "unticked" (a no) from "a request that never
          carried the box" (no answer, the default stands). */}
      <input type="hidden" name="marketingAsked" value="1" />
      <label className="nf-tap mt-sm flex cursor-pointer items-start gap-sm">
        <input
          type="checkbox"
          name="marketingEmail"
          value="yes"
          data-testid="marketing-email"
          className="mt-3xs h-5 w-5 shrink-0 accent-[var(--nf-brand-primary)]"
        />
        <span className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {t.safety.marketingLabel}
        </span>
      </label>

      {/* The version travels with the form, so the trigger records WHAT was
          accepted rather than only that something was. */}
      {accepted && <input type="hidden" name="termsVersion" value={TERMS_VERSION} />}

      <FieldProblem id="accept-terms-error" message={showError ? t.safety.acceptRequired : null} />
    </div>
  );
}
