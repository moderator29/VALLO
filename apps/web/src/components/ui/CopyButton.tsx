"use client";

import { useCallback } from "react";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { copyText } from "@/lib/ui/clipboard";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useDoneFlash } from "@/lib/ui/use-done-flash";
import "./copy-button.css";

/**
 * THE ONE COPY CONTROL (founder, 10 November 2026: "easy copy click-board
 * things, banner stuff like the archived banner, clean, wide platform").
 *
 * A small icon button with an accessible name. It copies through the async
 * clipboard with a textarea fallback (`lib/ui/clipboard.ts`), says what it
 * copied in the one top banner ("Link copied", "Code copied", "Copied"), and
 * shows a check for a beat in place of the copy glyph. The swap is a change of
 * glyph, not a motion, so it needs no reduced-motion branch. It works with or
 * without the client copy provider (the admin console has none), which is why
 * its words are plain English props with defaults.
 *
 * Small on purpose: no dictionary, no sheet, nothing but the clipboard helper,
 * the banner and an icon, so it is cheap on any page.
 */
export type CopyKind = "text" | "link" | "code";

export const COPY_WORDS = {
  text: "Copied",
  link: "Link copied",
  code: "Code copied",
  failed: "Could not copy. Select it and copy by hand.",
  action: "Copy",
} as const;

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
    const done = await copyText(typeof value === "function" ? value() : value);
    if (done) {
      feedback("select");
      flash();
      banner.success(message ?? COPY_WORDS[kind]);
    } else {
      banner.error(COPY_WORDS.failed);
    }
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

/** A value shown as text with its copy button beside it: a reference, an id, an email. */
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
      <span className="nf-copy-value__text">{value}</span>
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
