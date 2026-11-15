"use client";

import { useId, useState, useTransition } from "react";
import { banner } from "@/lib/ui/toast";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { submitDocFeedback } from "@/lib/support/doc-feedback";
import "@/app/css/docs-kit.css";

/**
 * "WAS THIS HELPFUL?" at the foot of a help answer, a guide or a chapter
 * (DOCS_AND_PRESENCE_UPGRADE.md 4.6). Yes is one tap and done. No asks, in
 * one optional line, what was missing, because a "no" with no reason tells
 * the desk only that a page failed, not how. The answer and its outcome are
 * announced politely; nothing moves but the words.
 *
 * Drawn only through `DocHelpfulSlot`, which checks the desk can receive it.
 */
export function DocHelpful({ page }: { page: string }) {
  const id = useId();
  const [state, setState] = useState<"ask" | "why" | "done">("ask");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  /* A refusal or a lost signal is said through the banner and the question
     stays. This page is public and weight-budgeted, so it does not pull in the
     app's offline helpers just to word a lost signal. */
  const send = (helpful: boolean, withNote?: string) =>
    start(async () => {
      try {
        const result = await submitDocFeedback({ page, helpful, note: withNote });
        if (result.ok) setState("done");
        else banner.error(result.error);
      } catch {
        banner.error("That did not go through. Check your connection and try again.");
      }
    });

  return (
    <section className="nf-doc-helpful" aria-labelledby={`${id}-q`}>
      <p id={`${id}-q`} className="nf-doc-helpful__q">
        Was this helpful?
      </p>
      <div aria-live="polite" className="nf-doc-helpful__body">
        {state === "ask" ? (
          <div className="nf-doc-helpful__choices">
            <button type="button" className="nf-chip" disabled={pending} onClick={() => send(true)}>
              <UiIcon name="check" size={16} />
              Yes
            </button>
            <button type="button" className="nf-chip" disabled={pending} onClick={() => setState("why")}>
              <UiIcon name="close" size={16} />
              No
            </button>
          </div>
        ) : state === "why" ? (
          <form
            className="nf-doc-helpful__why"
            onSubmit={(e) => {
              e.preventDefault();
              send(false, note);
            }}
          >
            <label htmlFor={`${id}-note`} className="nf-doc-helpful__label">
              What was missing? (optional)
            </label>
            <textarea autoCapitalize="sentences" enterKeyHint="enter"
              id={`${id}-note`}
              className="nf-field"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="submit" className="nf-chip" aria-pressed="true" disabled={pending}>
              Send
            </button>
          </form>
        ) : (
          <p className="nf-doc-helpful__thanks">Thank you. The support team reads every answer.</p>
        )}
      </div>
    </section>
  );
}
