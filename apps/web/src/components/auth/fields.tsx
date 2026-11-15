"use client";
import { cleanKindFor, cleanOnPaste } from "@/lib/paste/field-paste";
import "@/app/css/auth.css";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * The form furniture the auth screens share.
 *
 * Lifted out of `AuthPanel` when the email form moved to its own route. These
 * are deliberately local to auth rather than reaching for `components/ui/Field`:
 * the auth fields carry an "Optional" chip on the label row, a four-segment
 * strength meter and a show/hide toggle that no other field on the platform
 * needs, and folding all three into the shared primitive would put auth-only
 * behaviour in front of every form in the product.
 *
 * Every word any of them draws arrives as a prop. There is no locale context
 * on this platform: the server component that renders the form reads the
 * cookie and hands the dictionary down, which is why `t` appears on three of
 * the four components below rather than being reached for inside them.
 */

/** One headed group inside the sign-up form. */
export function FormGroup({
  title,
  step,
  note,
  children,
}: {
  title: string;
  step: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--nf-panel-hair)] pt-5 first:border-t-0 first:pt-0 [&+section]:mt-7">
      <div className="mb-md flex items-baseline justify-between gap-3">
        <h2 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
          {title}
        </h2>
        <span className="nf-numeric shrink-0 text-[length:var(--nf-text-label)] font-semibold uppercase tracking-[var(--nf-tracking-label)] text-[var(--nf-content-muted)]">
          {step}
        </span>
      </div>
      {note && (
        <p className="mb-4 text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          {note}
        </p>
      )}
      <div className="space-y-md">{children}</div>
    </section>
  );
}

/**
 * Label row with an optional marker chip for non-required fields.
 *
 * `optional` is the chip's own word rather than a boolean, so the row never has
 * to know which language it is in: a field that is required passes nothing and
 * gets no chip, exactly as before.
 */
function LabelRow({
  htmlFor,
  label,
  optional,
}: {
  htmlFor: string;
  label: string;
  optional?: string;
}) {
  return (
    <span className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="nf-label">
        {label}
      </label>
      {/* A plain word, not a chip: a chip at the tap floor read as a button. */}
      {optional && (
        <span className="mb-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{optional}</span>
      )}
    </span>
  );
}

/* The words go to the one banner; the field keeps its red edge and this
   visually hidden note (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */
function FieldError({ id, error }: { id: string; error?: string }) {
  return <FieldProblem id={id} message={error} />;
}

export function Field({
  id,
  name,
  type,
  label,
  placeholder,
  autoComplete,
  error,
  optional,
  t,
  value,
  onChange,
  onBlur,
  inputMode,
  enterKeyHint,
  className,
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  error?: string;
  optional?: boolean;
  /* Optional, because a controlled field needs no dictionary for the one word
     this component would use it for. */
  t?: Dictionary;
  /*
   * Controlled, optionally.
   *
   * Every field on the sign-up form is uncontrolled and should stay that way:
   * the browser fills them, the action reads the FormData, and no state exists
   * to disagree with what is on the screen. The confirmation code is the one
   * field that has to be watched as it is typed, because reaching six digits
   * IS the submit. Adding two optional props keeps that field inside the same
   * component as every other one, which is what keeps the aria-invalid and
   * aria-describedby wiring in a single place.
   */
  value?: string;
  onChange?: (value: string) => void;
  /* Fires when the field loses focus, with its current value. The sign-up
     email field uses it to ask whether the address is already registered,
     which is a question worth asking once somebody has finished typing and
     not thirty times while they are. */
  onBlur?: (value: string) => void;
  inputMode?: "numeric" | "text" | "email" | "tel";
  /* What the phone keyboard's return key says: "next" mid-form, "go" on the
     last field of a one-step form. */
  enterKeyHint?: "next" | "go" | "done" | "send";
  className?: string;
}) {
  const errorId = `${id}-error`;
  const controlled = value !== undefined && onChange !== undefined;
  /*
   * THE PHONE KEYBOARD, SET FOR WHAT IS TYPED. An address or a code is never
   * capitalised, corrected or spell-checked (iOS would turn "ada@" into
   * "Ada@"); a name starts each word with a capital. Derived from the
   * autocomplete token so no call site has to remember it.
   */
  const cleanKind = cleanKindFor({ type, inputMode, autoComplete });
  const literal = type === "email" || autoComplete === "one-time-code" || autoComplete === "off";
  const named = autoComplete === "given-name" || autoComplete === "family-name" || autoComplete === "nickname";
  const keyboard = literal
    ? ({ autoCapitalize: "none", autoCorrect: "off", spellCheck: false } as const)
    : named
      ? ({ autoCapitalize: "words", spellCheck: false } as const)
      : {};
  return (
    <div className="nf-auth-field">
      <LabelRow
        htmlFor={id}
        label={label}
        optional={optional && t ? t.signUp.optional : undefined}
      />
      {/* The box carries the address tick (auth.css, "THE FIELDS, ALIVE");
          focus paints nothing on it, so the field reads native. */}
      <div className="nf-auth-field__box">
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode ?? (type === "email" ? "email" : undefined)}
          {...keyboard}
          enterKeyHint={enterKeyHint}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={className ? `nf-field nf-field--glass ${className}` : "nf-field nf-field--glass"}
          {...(controlled
            ? { value, onChange: (event) => onChange(event.target.value) }
            : {})}
          {...(onBlur ? { onBlur: (event) => onBlur(event.target.value) } : {})}
          /* A pasted email or phone number is cleaned as it lands (14 November
             2026): "Seyi <Seyi@Example.com> " is seyi@example.com. Typing is
             never touched. */
          {...(cleanKind ? { onPaste: (event) => cleanOnPaste(event, cleanKind) } : {})}
        />
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

/**
 * Native select dressed as a platform field. The browser picker keeps the
 * control fully accessible on mobile; only the closed face is restyled, with
 * an inline chevron replacing the platform arrow.
 */
export function SelectField({
  id,
  name,
  label,
  placeholder,
  options,
  error,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  /**
   * The value posted and the word shown, apart. They were one string until the
   * form learned to speak four languages, and merging them again would post a
   * Yoruba answer at a validator that only knows the English one.
   */
  options: readonly { value: string; label: string }[];
  error?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <LabelRow htmlFor={id} label={label} />
      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue=""
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="nf-field nf-field--glass appearance-none pr-11"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[var(--nf-content-muted)]"
        >
          <UiIcon name="chevron-down" size="xs" />
        </span>
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

/**
 * Password field with a client-side show/hide toggle.
 *
 * The toggle is a real button (not a decorated span) so it is reachable by
 * keyboard, and it announces its state via aria-pressed plus a swapped label.
 * Toggling only flips the input type; the value never leaves the field. The
 * value is controlled by the parent so the strength meter and the confirm
 * check can react as the user types.
 */
export function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  error,
  value,
  onChange,
  t,
  autoFocus,
  enterKeyHint,
}: {
  id: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  error?: string;
  value: string;
  onChange: (next: string) => void;
  t: Dictionary;
  /** True when this is the one field left to fill, as on the email-first
      sign-in where the address arrived from the screen before. */
  autoFocus?: boolean;
  /* The return key's word, as on `Field`. */
  enterKeyHint?: "next" | "go" | "done";
}) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div className="nf-auth-field">
      <LabelRow htmlFor={id} label={label} />
      <div className="nf-auth-field__box relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus={autoFocus}
          /* Shown as text, a phone keyboard would otherwise capitalise and
             "correct" the password being typed. */
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={enterKeyHint}
          className="nf-field nf-field--glass pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? t.signUp.hidePassword : t.signUp.showPassword}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-control text-[var(--nf-content-muted)] transition-colors hover:text-[var(--nf-content-secondary)]"
        >
          <EyeGlyph off={visible} />
        </button>
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

type StrengthScore = 0 | 1 | 2 | 3 | 4;

/**
 * Client-side strength estimate from length, letter case, digits and symbols.
 * Anything under 8 characters is always weak, matching the server minimum.
 * This is guidance only; the server never trusts it.
 */
function scorePassword(pw: string): StrengthScore {
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  let met = 1; // length criterion already met
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) met += 1;
  if (/\d/.test(pw)) met += 1;
  if (/[^A-Za-z0-9]/.test(pw)) met += 1;
  return met as StrengthScore;
}

/*
 * The rungs, in the reader's language. Rung 0 is deliberately empty in every
 * locale: an empty field has no strength to report and a word there would be a
 * verdict on nothing.
 */
function strengthLabel(score: StrengthScore, t: Dictionary): string {
  switch (score) {
    case 0:
      return "";
    case 1:
      return t.signUp.strength.weak;
    case 2:
      return t.signUp.strength.fair;
    case 3:
      return t.signUp.strength.good;
    case 4:
      return t.signUp.strength.strong;
  }
}

const STRENGTH_COLOURS: Record<StrengthScore, string> = {
  0: "transparent",
  1: "var(--nf-state-error)",
  2: "var(--nf-state-warning)",
  3: "var(--nf-brand-secondary)",
  4: "var(--nf-state-success)",
};

/** Four-segment strength bar with a text label, announced politely. */
export function StrengthMeter({ password, t }: { password: string; t: Dictionary }) {
  const score = scorePassword(password);
  const colour = STRENGTH_COLOURS[score];

  return (
    <div className="-mt-xs">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-xs">
          {([1, 2, 3, 4] as const).map((segment) => (
            <span
              key={segment}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background: segment <= score ? colour : "var(--nf-border-subtle)",
              }}
            />
          ))}
        </div>
        <span
          aria-live="polite"
          className="min-w-[3.25rem] text-right text-[length:var(--nf-text-overline)] font-semibold"
          style={{ color: score === 0 ? "var(--nf-content-muted)" : colour }}
        >
          {strengthLabel(score, t)}
        </span>
      </div>
    </div>
  );
}

/**
 * The reveal control's mark.
 *
 * Two eyes were drawn inline on this platform, here at strokeWidth 1.7 and in
 * `wallet/BalanceCard` at 2, for the same job. Both are the platform glyph now,
 * at the platform's own derived stroke, and this is a two-line name choice
 * rather than a drawing.
 */
function EyeGlyph({ off }: { off: boolean }) {
  return <UiIcon name={off ? "eye-off" : "eye"} size="sm" />;
}
