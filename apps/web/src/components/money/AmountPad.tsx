"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { Chip } from "@/components/ui/Chip";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { feedback } from "@/lib/ui/feedback";
import "@/app/css/money-layer.css";

/**
 * THE AMOUNT ENTRY (docs/design/references/2026-10-05/IMG_7027.png and
 * PREMIUM-STANDARD reference 9): a huge figure with a quiet naira sign, a
 * muted question under it, quick-amount chips, a calm keypad of soft rounded
 * keys. The confirm that follows is the flow's own (`DragToConfirm` on the
 * review), never this component's.
 *
 * It holds nothing: the caller owns the plain figure ("25000"), exactly what
 * `NairaField` hands over and every money parser on the server expects. Whole
 * naira only, as the balance flows take.
 *
 * The figure is a real text field, so a keyboard types into it on the web and
 * a screen reader hears a labelled amount; `inputMode="none"` keeps a phone's
 * own keyboard away, because the keypad under it is the phone's keyboard here.
 *
 * The chips are arithmetic on a figure the caller read from the server (the
 * Available balance), floored to whole naira. "Max" is the whole Available
 * figure; when a fee would take the total past it, the server says so on the
 * review before anything moves.
 */
const MAX_DIGITS = 11;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"] as const;

function grouped(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function clean(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^0+/, "");
  return d.slice(0, MAX_DIGITS);
}

export type AmountChip = { label: string; naira: number };

/** 25%, 50% and Max of an Available figure in kobo, floored to whole naira. Empty when nothing is available. */
export function shareChips(availableMinor: number): AmountChip[] {
  if (!(availableMinor >= 100)) return [];
  const naira = (pct: number) => Math.floor((availableMinor * pct) / 100 / 100);
  return [
    { label: "25%", naira: naira(25) },
    { label: "50%", naira: naira(50) },
    { label: "Max", naira: Math.floor(availableMinor / 100) },
  ].filter((c) => c.naira > 0);
}

export function AmountPad({
  value,
  onValueChange,
  label,
  question,
  context,
  chips = [],
  hint,
  symbol = "₦",
  testId,
}: {
  value: string;
  onValueChange(next: string): void;
  /** The field's accessible name ("Amount to withdraw"). */
  label: string;
  /** The muted line under the figure (IMG_7027's "Who's it for?"). */
  question: ReactNode;
  /** Above the figure: who or where it goes. */
  context?: ReactNode;
  chips?: AmountChip[];
  hint?: ReactNode;
  symbol?: string;
  testId?: string;
}) {
  const id = useId();
  const digits = clean(value);
  const set = (next: string) => {
    const c = clean(next);
    if (c !== digits) onValueChange(c);
  };
  const press = (key: (typeof KEYS)[number]) => {
    feedback("select");
    if (key === "del") set(digits.slice(0, -1));
    else set(digits + key);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      set(digits.slice(0, -1));
    }
  };
  const long = digits.length > 7;

  return (
    <div className="nf-pad" data-testid={testId}>
      {context ? <div className="nf-pad__context">{context}</div> : null}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="nf-pad__figure nf-numeric" data-empty={digits ? undefined : "true"} data-long={long ? "true" : undefined}>
        <span className="nf-pad__cur" aria-hidden="true">
          {symbol}
        </span>
        <input
          id={id}
          className="nf-pad__input"
          inputMode="none"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0"
          value={grouped(digits)}
          /* One "0" wide per character, so the sign stays beside the figure
             as it grows (field-sizing is not in every WebView yet). */
          style={{ width: `${Math.max(1, grouped(digits).length - (grouped(digits).match(/,/g)?.length ?? 0) * 0.55)}ch` }}
          onChange={(e) => set(e.target.value)}
          onKeyDown={onKey}
          data-testid={testId ? `${testId}-input` : undefined}
        />
      </div>
      <p className="nf-pad__question">{question}</p>

      {chips.length > 0 ? (
        <div className="nf-pad__chips" role="group" aria-label="Quick amounts">
          {chips.map((c) => (
            <Chip
              key={c.label}
              behaviour="choice"
              selected={digits !== "" && Number(digits) === c.naira}
              onSelectedChange={() => {
                feedback("select");
                set(String(c.naira));
              }}
              data-testid={testId ? `${testId}-chip-${c.label}` : undefined}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="nf-pad__keys" role="group" aria-label="Keypad">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="nf-pad__key nf-numeric"
            onClick={() => press(key)}
            aria-label={key === "del" ? "Delete last digit" : key === "00" ? "Double zero" : key}
            disabled={key === "del" ? digits === "" : digits.length >= MAX_DIGITS || (digits === "" && (key === "0" || key === "00"))}
          >
            {key === "del" ? (
              <UiIcon name="backspace" size={24} />
            ) : (
              key
            )}
          </button>
        ))}
      </div>
      {hint ? <p className="nf-pad__hint">{hint}</p> : null}
    </div>
  );
}
