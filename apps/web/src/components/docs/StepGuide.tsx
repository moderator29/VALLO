"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { hasShot, shotSrc } from "@/lib/docs/shots";
import "./docs-kit.css";

/**
 * THE STEP GUIDE.
 *
 * A "Before you start" checklist (what to have in hand, tickable), then
 * numbered steps. Each step is a short paragraph, optionally an example screen
 * captured from the product's preview fixtures in both themes, and optionally
 * document buttons. Read top to bottom it is a plain ordered list, which is
 * also what search engines, screen readers and a page with no script get.
 * "Walk through it" turns the same steps into a player that advances one at a
 * time with Back and Next and a progress bar.
 *
 * Every capture is labelled as an example screen. None of these is a live
 * account, and the caption says so.
 */
export type GuideStep = {
  title: string;
  body: ReactNode;
  /** `guide/step` key into the capture set, for example `making-an-offer/03-amount`. */
  shot?: { key: string; alt: string; caption?: string };
  /** Document buttons for the end of this step, rendered by the caller. */
  actions?: ReactNode;
};

function Shot({ shot }: { shot: NonNullable<GuideStep["shot"]> }) {
  const caption = shot.caption ?? "Example screen from the product.";
  if (!hasShot(shot.key)) {
    return (
      <figure className="nf-dk-shot">
        <div className="nf-dk-shot--empty">Example screen to follow. The steps above are complete without it.</div>
      </figure>
    );
  }
  return (
    <figure className="nf-dk-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-shot="dark" src={shotSrc(shot.key, "dark")} alt={shot.alt} width={390} height={844} loading="lazy" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-shot="light" src={shotSrc(shot.key, "light")} alt={shot.alt} width={390} height={844} loading="lazy" decoding="async" />
      <figcaption>{caption} Example screen, not a live account.</figcaption>
    </figure>
  );
}

function StepBody({ step, index }: { step: GuideStep; index: number }) {
  return (
    <div className="nf-dk-step">
      <span className="nf-dk-step__n" aria-hidden="true">
        {index + 1}
      </span>
      <div>
        <h3 className="nf-dk-step__title">{step.title}</h3>
        <div className="nf-dk-step__body">{step.body}</div>
        {step.shot ? <Shot shot={step.shot} /> : null}
        {step.actions}
      </div>
    </div>
  );
}

export function StepGuide({
  before,
  steps,
  label,
}: {
  before?: readonly string[];
  steps: readonly GuideStep[];
  label: string;
}) {
  const [player, setPlayer] = useState(false);
  const [at, setAt] = useState(0);
  const checkId = useId();
  const current = steps[at];

  return (
    <div>
      {before && before.length > 0 ? (
        <section className="nf-dk-before" aria-label="Before you start">
          <h3>Before you start</h3>
          <ul>
            {before.map((item, index) => (
              <li key={item}>
                <label htmlFor={`${checkId}-${index}`}>
                  <input id={`${checkId}-${index}`} type="checkbox" />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="nf-dk-actions__row">
        <Button variant="secondary" size="sm" onClick={() => (setPlayer((p) => !p), setAt(0))}>
          {player ? "Show all steps" : "Walk through it"}
        </Button>
      </div>

      {player && current ? (
        <section className="nf-dk-player" aria-label={`${label}, step by step`}>
          <p className="nf-dk-player__count" aria-live="polite">
            Step {at + 1} of {steps.length}
          </p>
          <ol className="nf-dk-player__dots" aria-hidden="true">
            {steps.map((step, i) => (
              <li key={step.title} data-done={i <= at || undefined} />
            ))}
          </ol>
          <div className="nf-dk-player__stage" key={at}>
            <StepBody step={current} index={at} />
          </div>
          <div className="nf-dk-player__nav">
            <Button variant="secondary" size="sm" disabled={at === 0} onClick={() => setAt((i) => Math.max(0, i - 1))}>
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={at === steps.length - 1}
              onClick={() => setAt((i) => Math.min(steps.length - 1, i + 1))}
            >
              Next
            </Button>
          </div>
        </section>
      ) : (
        <ol className="nf-dk-steps" aria-label={label}>
          {steps.map((step, index) => (
            <li key={step.title}>
              <StepBody step={step} index={index} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
