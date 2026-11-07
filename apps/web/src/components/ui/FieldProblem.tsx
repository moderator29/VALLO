"use client";

import { useEffect } from "react";
import { banner } from "@/lib/ui/toast";

/**
 * A FIELD WITH A PROBLEM, SAID BY THE ONE BANNER (founder, 7 November 2026,
 * "THE BANNER EVERYWHERE"). The field keeps only its red edge
 * (`aria-invalid` on the control); its words go to the banner at the top of
 * the screen, and stay here in a visually hidden note so the control can
 * name it with `aria-describedby` and a screen reader hears it on focus.
 *
 * Several fields refused at once (a form returned with three problems) say
 * the FIRST in reading order: effects run in document order for siblings, so
 * the first note to ask in a tick wins and the rest wait for the person to
 * fix that one. The banner's own queue would otherwise show the last.
 *
 *   <input aria-invalid={error ? true : undefined} aria-describedby={error ? "x-error" : undefined} />
 *   <FieldProblem id="x-error" message={error} />
 */

let asked: string | null = null;

/** Say a field's problem in the banner; the first asked in one tick wins. */
export function sayFieldProblem(message: string): void {
  if (asked !== null) return;
  asked = message;
  queueMicrotask(() => {
    const said = asked;
    asked = null;
    if (said) banner.error(said, { "data-testid": "banner-field" });
  });
}

export function FieldProblem({
  id,
  message,
  when,
}: {
  id: string;
  message: string | null | undefined;
  /** A new answer with the same words (a `useActionState` result) says them again. */
  when?: unknown;
}) {
  useEffect(() => {
    if (message) sayFieldProblem(message);
  }, [message, when]);
  if (!message) return null;
  return (
    <span id={id} className="sr-only" data-field-problem="">
      {message}
    </span>
  );
}
