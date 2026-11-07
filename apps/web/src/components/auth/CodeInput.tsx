"use client";
import "@/app/css/auth.css";

import { useState } from "react";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * THE CODE FIELD, DRAWN AS CELLS (30 September).
 *
 * ONE REAL INPUT, STILL. The reasons `VerifyCodeForm` gives for refusing a
 * box per digit all stand: a single field is what password managers, the
 * mail app's "copy code" and the phone's one-time-code suggestion fill in
 * one go, and what a screen reader reads as one labelled field. So the input
 * is the whole of the control, sitting over the cells with its own text made
 * transparent; the cells are a picture of its value, hidden from assistive
 * technology.
 *
 * THE MOTION. Each digit pops into its cell as it arrives; the cell waiting
 * for the next digit carries a soft caret; a wrong code shakes the row once
 * (`wrongCount` restarts it on every refusal); a surplus paste lights every
 * cell as an error. Transform and opacity only, answered for reduced motion,
 * Calm and Off in auth.css ("THE CODE").
 *
 * Every attribute the plain field carried is here unchanged: `one-time-code`
 * autocomplete, the numeric keyboard, 16px type (iOS never zooms), no
 * capitalisation or correction, and the error wired through aria-invalid and
 * aria-describedby. The value is never truncated: a surplus is the form's to
 * say, not this component's to hide.
 */
export function CodeInput({
  id,
  name,
  label,
  length,
  value,
  onChange,
  error,
  wrongCount,
  placeholder,
  cellsLabel,
}: {
  id: string;
  name: string;
  label: string;
  length: number;
  value: string;
  onChange: (value: string) => void;
  error?: string | null | undefined;
  /** How many times the server has refused a code; each one shakes once. */
  wrongCount: number;
  placeholder: string;
  /** "Six digit code", kept for the cells' tooltip-free description. */
  cellsLabel: string;
}) {
  const [focused, setFocused] = useState(false);
  const errorId = `${id}-error`;
  const digits = value.slice(0, length).split("");
  const over = value.length > length;
  const next = Math.min(digits.length, length - 1);

  return (
    <div className="nf-auth-field nf-code" data-error={error ? "" : undefined}>
      <label htmlFor={id} className="nf-label">
        {label}
      </label>
      <div
        className="nf-code__box"
        /* Two names for one shake, alternating, so every refusal restarts
           the animation rather than matching a rule that already ran. */
        data-shake={wrongCount === 0 ? undefined : wrongCount % 2 === 0 ? "b" : "a"}
      >
        <div className="nf-code__cells" aria-hidden="true" title={cellsLabel}>
          {Array.from({ length }, (_, i) => {
            const digit = digits[i];
            return (
              <span
                key={i}
                className="nf-code__cell"
                data-filled={digit ? "" : undefined}
                data-next={focused && !digit && i === next ? "" : undefined}
                data-over={over ? "" : undefined}
              >
                {digit ? (
                  /* Keyed by the digit, so a changed digit pops in again. */
                  <span key={`${i}-${digit}`} className="nf-code__digit">
                    {digit}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          /* `one-time-code` is what makes iOS and Android offer the code from
             the message above the keyboard. */
          autoComplete="one-time-code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="nf-code__input nf-numeric"
        />
      </div>
      {/* The words go to the one banner; the field keeps its red edge (founder, 7 November 2026). */}
      <FieldProblem id={errorId} message={error} when={wrongCount} />
    </div>
  );
}
