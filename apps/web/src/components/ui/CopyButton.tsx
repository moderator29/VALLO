"use client";

import { useCallback } from "react";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { COPY_WORDS, copyAndSay, type CopyKind } from "@/lib/ui/copy-and-say";
import { useDoneFlash } from "@/lib/ui/use-done-flash";
import "./copy-button.css";

/**
 * THE ONE COPY CONTROL (founder, 10 November 2026: "easy copy click-board
 * things, banner stuff like the archived banner, clean, wide platform").
 *
 * A small icon button with an accessible name. It copies through the async
 * clipboard with a textarea fallback (`lib/ui/clipboard.ts`), says what it
 * copied in the quick pill at the bottom of the screen ("Link copied", "Code
 * copied", "Copied"; founder, 14 November 2026), and shows a check for a beat
 * in place of the copy glyph. A copy that failed is an error and is said at
 * the top. The swap is a change of
 * glyph, not a motion, so it needs no reduced-motion branch. It works with or
 * without the client copy provider (the admin console has none), which is why
 * its words are plain English props with defaults.
 *
 * Small on purpose: no dictionary, no sheet, nothing but the clipboard helper,
 * the banner and an icon, so it is cheap on any page.
 */
export function CopyButton({
  value,
  kind = "text",
  label,
  message,
  className,
  testId,
}: {
  /** What goes on the clipboard (a function is read at the tap, for an address built from the browser's origin). */
  value: string | (() => string);
  kind?: CopyKind;
  /** The accessible name, e.g. "Copy booking reference". Defaults to "Copy". */
  label?: string;
  /** The banner's words, e.g. "Reference copied". Defaults by kind. */
  message?: string;
  className?: string;
  testId?: string;
}) {
  const [copied, flash] = useDoneFlash(1800);
  const onCopy = useCallback(async () => {
    if (await copyAndSay(typeof value === "function" ? value() : value, kind, message)) flash();
  }, [value, kind, message, flash]);

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      aria-label={label ?? COPY_WORDS.action}
      data-copied={copied ? "" : undefined}
      data-testid={testId ?? "copy-button"}
      className={`nf-icon-btn nf-icon-btn--round nf-copy ${className ?? ""}`.trim()}
    >
      <UiIcon name={copied ? "check" : kind === "link" ? "link" : "clipboard-list"} size={16} />
    </button>
  );
}

/**
 * A value shown as text with its copy button beside it: a reference, an id, an
 * email. A double tap on the value itself copies it too (copy without the
 * menu), and says so the same way; the button stays the named control.
 */
export function CopyValue({
  value,
  kind = "text",
  label,
  message,
  className,
  testId,
}: {
  value: string;
  kind?: CopyKind;
  label?: string;
  message?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <span className={`nf-copy-value ${className ?? ""}`.trim()} data-testid={testId}>
      <span className="nf-copy-value__text" onDoubleClick={() => void copyAndSay(value, kind, message)}>
        {value}
      </span>
      <CopyButton value={value} kind={kind} {...(label ? { label } : {})} {...(message ? { message } : {})} />
    </span>
  );
}

/** Copy a page of ours by its path: the address is built from the browser's own origin at the tap. */
export function CopyLink({ path, label, message, className, testId }: { path: string; label?: string; message?: string; className?: string; testId?: string }) {
  return (
    <CopyButton
      kind="link"
      value={() => `${window.location.origin}${path}`}
      {...(label ? { label } : {})}
      {...(message ? { message } : {})}
      {...(className ? { className } : {})}
      {...(testId ? { testId } : {})}
    />
  );
}
