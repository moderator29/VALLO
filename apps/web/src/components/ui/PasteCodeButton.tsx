"use client";

import { useSyncExternalStore } from "react";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { pastedCode } from "@/lib/paste/paste";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import "./paste-code.css";

export const PASTE_CODE_WORDS = {
  paste: "Paste",
  label: "Paste the code",
  empty: "There is no code on the clipboard to paste.",
  blocked: "This browser did not let Vallo read the clipboard. Press and hold the field, then choose Paste.",
} as const;

const never = () => () => undefined;
const canRead = () => typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

/**
 * PASTE A CODE IN ONE TAP (founder, 14 November 2026).
 *
 * Beside a one-time code field: reads the clipboard at the tap, finds the
 * code in whatever it arrived in ("Your code is 482 913"), and hands it to
 * the field. The form submits itself when the code is complete, the way it
 * does when the code is typed.
 *
 * On an iPhone the system shows its own notice that the clipboard was read.
 * That is the phone's, and expected. Vallo is never told where a paste came
 * from and says nothing about it.
 *
 * Drawn only where the browser can read the clipboard at all; elsewhere the
 * field's own paste (press and hold) is the way, and it cleans the same way.
 */
export function PasteCodeButton({ length, onCode, className }: { length: number; onCode(code: string): void; className?: string }) {
  const able = useSyncExternalStore(never, canRead, () => false);
  if (!able) return null;
  return (
    <button
      type="button"
      className={`nf-paste-code ${className ?? ""}`.trim()}
      aria-label={PASTE_CODE_WORDS.label}
      data-testid="paste-code"
      onClick={() => {
        void navigator.clipboard.readText().then(
          (text) => {
            const code = pastedCode(text, length);
            if (!code) {
              banner.warning(PASTE_CODE_WORDS.empty);
              return;
            }
            feedback("select");
            onCode(code);
          },
          () => banner.warning(PASTE_CODE_WORDS.blocked),
        );
      }}
    >
      <UiIcon name="clipboard-list" size={16} />
      <span>{PASTE_CODE_WORDS.paste}</span>
    </button>
  );
}
