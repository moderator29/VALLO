"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { GuideShot, ShotPlaceholder } from "./GuideShot";
import "@/app/css/docs-kit.css";

export type PlayerStep = {
  id: string;
  title: string;
  text: string;
  shot?: { dark: string; light: string; alt: string };
};

/**
 * THE STEP GUIDE PLAYER (DOCS_AND_PRESENCE_UPGRADE.md 4.6): a how-to's steps
 * one at a time, each with the real screen it happens on, advanced by Back
 * and Next, so a member can walk the whole flow before starting it. Plain
 * buttons in the tab order; the step count is announced politely as it
 * changes. A step arrives with a short rise that stands still under reduced
 * motion and the in-app Motion setting (docs-kit.css). Until the capture
 * runs, every screen is the placeholder plate and the player still works.
 */
export function StepPlayer({ steps, icon, label }: { steps: PlayerStep[]; icon: UiIconName; label: string }) {
  const id = useId();
  const [at, setAt] = useState(0);
  const step = steps[at];
  if (!step) return null;
  const last = steps.length - 1;
  return (
    <section className="nf-doc-player" aria-labelledby={`${id}-label`} aria-roledescription="step guide">
      <div className="nf-doc-player__head">
        <p id={`${id}-label`} className="nf-doc-player__label">
          {label}
        </p>
        <p className="nf-doc-player__count" aria-live="polite" aria-atomic="true">
          Step {at + 1} of {steps.length}
        </p>
      </div>
      <div className="nf-doc-player__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${(at + 1) / steps.length})` }} />
      </div>
      <div key={step.id} className="nf-doc-player__stage">
        <div className="nf-doc-player__shot">
          {step.shot ? (
            <GuideShot dark={step.shot.dark} light={step.shot.light} alt={step.shot.alt} fallback={<ShotPlaceholder icon={icon} ratio="3/4" />} />
          ) : (
            <ShotPlaceholder icon={icon} ratio="3/4" />
          )}
        </div>
        <div className="nf-doc-player__text">
          <h3 className="nf-doc-player__title">{step.title}</h3>
          <p className="nf-doc-player__body">{step.text}</p>
          <a href={`#${step.id}`} className="nf-doc-xlink">
            Read this step in full
          </a>
        </div>
      </div>
      <div className="nf-doc-player__nav">
        <Button type="button" variant="secondary" size="md" leadingIcon="arrow-left" disabled={at === 0} onClick={() => setAt((n) => Math.max(0, n - 1))}>
          Back
        </Button>
        <Button type="button" variant="primary" size="md" trailingIcon="arrow-right" disabled={at === last} onClick={() => setAt((n) => Math.min(last, n + 1))}>
          Next
        </Button>
      </div>
    </section>
  );
}
