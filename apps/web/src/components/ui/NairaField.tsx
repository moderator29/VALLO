"use client";

import { useLayoutEffect, useRef } from "react";
import { Field } from "@/components/ui/Field";
import { caretAfter, readNairaTyping, significantBefore } from "@/lib/ui/naira-input";
import { cleanPastedFigure } from "@/lib/paste/paste";

/**
 * A naira amount (details pass, 30 September 2026): "₦" fixed at the front,
 * the number keypad, and the figure grouped as it is typed ("1,500,000"), the
 * caret kept after the digit the person just typed. The caller holds and
 * sends the plain figure ("1500000"); `name` posts that plain figure from a
 * hidden input, so a server action reading FormData gets exactly what every
 * money parser expects. A pasted amount is cleaned as it lands.
 */
export function NairaField({
  label,
  value,
  onValueChange,
  name,
  hint,
  error,
  required,
  allowKobo = false,
  placeholder,
  id,
  className,
  "data-testid": testId,
}: {
  label: string;
  /** The plain figure, "1500000". */
  value: string;
  onValueChange(value: string): void;
  name?: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  /** Take up to two kobo digits after a point. */
  allowKobo?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);
  const display = readNairaTyping(value, allowKobo).display;

  /* After React writes the regrouped text, put the caret back where it was. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current === null || document.activeElement !== el) return;
    const at = caretAfter(el.value, caret.current);
    el.setSelectionRange(at, at);
    caret.current = null;
  });

  return (
    <Field
      label={label}
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
      {...(required ? { required } : {})}
      {...(id ? { id } : {})}
      {...(className ? { className } : {})}
    >
      {(control) => (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-semibold text-[var(--nf-content-muted)]"
          >
            ₦
          </span>
          <input
            {...control}
            ref={ref}
            type="text"
            inputMode={allowKobo ? "decimal" : "numeric"}
            autoComplete="off"
            enterKeyHint="done"
            className="nf-field nf-numeric w-full pl-affordance"
            value={display}
            placeholder={placeholder}
            data-testid={testId}
            onChange={(event) => {
              const raw = event.target.value;
              caret.current = significantBefore(raw, event.target.selectionStart ?? raw.length);
              onValueChange(readNairaTyping(raw, allowKobo).value);
            }}
            /* A pasted amount ("₦1,250,000.00", "NGN 1 250 000", "1.25m") is
               the figure, whole: its sign and commas go and it replaces what
               the field held (14 November 2026). Plain digits are left to the
               browser's own paste. */
            onPaste={(event) => {
              const figure = cleanPastedFigure(event.clipboardData?.getData("text/plain") ?? "", allowKobo);
              if (figure === null) return;
              event.preventDefault();
              caret.current = null;
              onValueChange(readNairaTyping(figure, allowKobo).value);
            }}
          />
          {name ? <input type="hidden" name={name} value={value} /> : null}
        </div>
      )}
    </Field>
  );
}
