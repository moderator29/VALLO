"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { feedback } from "@/lib/ui/feedback";

/**
 * The dots and the keypad. Large round keys, a delete key, a press state you
 * can feel (a scale and a fill, turned into a plain fill under reduced
 * motion), and the physical keyboard too: digits type, Backspace deletes.
 *
 * The bottom-left key is empty on the web. It is where a biometric unlock
 * goes in the native app (`lib/passcode/native-unlock.ts`), passed in as
 * `accessory`.
 */

export function PasscodeDots({
  length,
  filled,
  shake,
  label,
}: {
  length: number;
  filled: number;
  /** Changes every wrong attempt, so the shake replays. */
  shake: number;
  label: string;
}) {
  /* Keyed by the attempt, so each wrong code starts its own shake and its own
     brief error colour. */
  return <DotsRow key={shake} length={length} filled={filled} erring={shake > 0} label={label} />;
}

/** How long a wrong code keeps the dots in the error colour (the shake is shorter). */
const ERROR_TINT_MS = 1200;

function DotsRow({ length, filled, erring, label }: { length: number; filled: number; erring: boolean; label: string }) {
  const [tinted, setTinted] = useState(erring);
  useEffect(() => {
    if (!erring) return;
    const timer = window.setTimeout(() => setTinted(false), ERROR_TINT_MS);
    return () => window.clearTimeout(timer);
  }, [erring]);
  return (
    <div
      className={`nf-passcode__dots${tinted ? " nf-passcode__dots--shake" : ""}`}
      role="img"
      aria-label={label}
      data-testid="passcode-dots"
    >
      {Array.from({ length }, (_, i) => (
        <span key={i} className={`nf-passcode__dot${i < filled ? " nf-passcode__dot--on" : ""}`} />
      ))}
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function Keypad({
  onDigit,
  onDelete,
  disabled,
  label,
  deleteLabel,
  accessory,
}: {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  disabled?: boolean;
  label: string;
  deleteLabel: string;
  accessory?: ReactNode;
}) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        onDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        onDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onDigit, onDelete]);

  /* THE TICK LANDS WITH THE FINGER, NOT AFTER IT (A.4). A click arrives on
     release, a beat after the key has already gone down under the press
     curve; the haptic on `pointerdown` arrives with it, so the key, the tick
     and the finger are one moment. A click with no pointer behind it (a
     keyboard's Enter or Space, `detail` 0) still ticks, once. */
  const touch = () => feedback("select");
  const tickIfKeyboard = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) feedback("select");
  };
  const press = (event: MouseEvent<HTMLButtonElement>, digit: string) => {
    tickIfKeyboard(event);
    onDigit(digit);
  };

  return (
    <div className="nf-passcode__keypad" role="group" aria-label={label} data-testid="passcode-keypad">
      {KEYS.map((digit) => (
        <button
          key={digit}
          type="button"
          className="nf-passcode__key"
          disabled={disabled}
          onPointerDown={touch}
          onClick={(event) => press(event, digit)}
        >
          {digit}
        </button>
      ))}
      <span className="nf-passcode__key-slot">{accessory}</span>
      <button type="button" className="nf-passcode__key" disabled={disabled} onPointerDown={touch} onClick={(event) => press(event, "0")}>
        0
      </button>
      <button
        type="button"
        className="nf-passcode__key nf-passcode__key--quiet"
        disabled={disabled}
        onPointerDown={touch}
        onClick={(event) => {
          tickIfKeyboard(event);
          onDelete();
        }}
        aria-label={deleteLabel}
      >
        <UiIcon name="backspace" size={26} />
      </button>
    </div>
  );
}
