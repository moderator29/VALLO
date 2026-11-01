"use client";

import "./progress-path.css";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { formatNumber, type Locale } from "@vallo/i18n/core";

/**
 * THE LEARNING PATH (the founder's reference 2, "The Foundation", 7 October
 * 2026; `PREMIUM-STANDARD.md`: "this is the shape for Vallo's multi-step
 * flows"). It replaces the hairline list of nodes this file drew before.
 *
 * Every step is a card: a small 3D tile on the left (the role renders in
 * `public/brand/session-b/roles/`, chosen per step by `path-tiles.ts`), the
 * step's name with one caption line under it, and a round status control on
 * the right. The cards are joined by a thin connector that runs through the
 * tile column, so the steps read as one path rather than a list.
 *
 * THE STATUS CONTROL, by shape and words, never colour alone:
 *   done      a filled brand disc with a check, and the card is a button
 *             back to that step (the same jump the rail's segments make);
 *   current   a progress ring around the step's number, the arc drawn to how
 *             far through the path the member is, `aria-current="step"`;
 *   upcoming  a hollow circle with the step's number, not a button, because
 *             the wizards do not let anybody skip past what they have not
 *             saved.
 * The connector is lit up to the current card and quiet after it.
 *
 * D28 still holds: the steps are the flow's own, in its order and words. This
 * only shows them. No motion of its own beyond the press; it opens inside
 * `Unfold`, whose motion it inherits.
 */
export type PathStep = {
  id: string;
  label: string;
  /** A second line under the name. Falls back to the state word. */
  caption?: string;
  /** The step's 3D tile (an image path). Omitted, the card draws its number. */
  tile?: string;
};

export function ProgressPath({
  steps,
  at,
  onJump,
  disabled = false,
  copy,
  locale = "en",
}: {
  steps: readonly PathStep[];
  /** The index of the step the member is on. */
  at: number;
  /** Omitted, no card is a button (an overview of the path ahead). */
  onJump?: (index: number) => void;
  disabled?: boolean;
  copy: { done: string; current: string; upcoming: string };
  locale?: Locale;
}) {
  const total = steps.length;
  return (
    <ol className="nf-ppath">
      {steps.map((step, index) => {
        const state = index < at ? "done" : index === at ? "current" : "upcoming";
        const words = state === "done" ? copy.done : state === "current" ? copy.current : copy.upcoming;
        const number = formatNumber(index + 1, locale);
        const body = (
          <>
            <span className="nf-ppath__tile" aria-hidden="true">
              {step.tile ? (
                // A decorative 256px render shown at 32px: a plain img keeps it
                // out of the image optimiser's queue on every wizard step.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={step.tile} alt="" width={32} height={32} loading="lazy" decoding="async" />
              ) : (
                <span className="nf-ppath__tilenum nf-numeric">{number}</span>
              )}
            </span>
            <span className="nf-ppath__text">
              <span className="nf-ppath__label">{step.label}</span>
              {step.caption ? (
                <span className="nf-ppath__state">
                  {words ? <span className="sr-only">{words}. </span> : null}
                  {step.caption}
                </span>
              ) : words ? (
                <span className="nf-ppath__state">{words}</span>
              ) : null}
            </span>
            <StatusMark state={state} number={number} progress={total > 0 ? (index + 0.5) / total : 0} />
          </>
        );
        return (
          <li key={step.id} className="nf-ppath__step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
            {state === "done" && onJump ? (
              <button type="button" className="nf-ppath__row" onClick={() => onJump(index)} disabled={disabled}>
                {body}
              </button>
            ) : (
              <div className="nf-ppath__row">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The round control on the right of a card: check, ring with a number, or a hollow number. */
function StatusMark({ state, number, progress }: { state: "done" | "current" | "upcoming"; number: string; progress: number }) {
  if (state === "done") {
    return (
      <span className="nf-ppath__mark nf-ppath__mark--done" aria-hidden="true">
        <UiIcon name="check" size={16} />
      </span>
    );
  }
  return (
    <span className={`nf-ppath__mark nf-ppath__mark--${state}`} aria-hidden="true">
      {state === "current" ? (
        <svg viewBox="0 0 36 36" className="nf-ppath__ring">
          <circle className="nf-ppath__ring-track" cx="18" cy="18" r="16" />
          <circle
            className="nf-ppath__ring-arc"
            cx="18"
            cy="18"
            r="16"
            pathLength={100}
            strokeDasharray={`${Math.max(8, Math.round(progress * 100))} 100`}
          />
        </svg>
      ) : null}
      <span className="nf-ppath__marknum nf-numeric">{number}</span>
    </span>
  );
}

/**
 * THE PROGRESS RING WITH A COUNT (reference 2): how many of the path's steps
 * are behind the member, drawn as an arc with the count inside it. Decorative
 * to assistive technology; the caller states the count in words beside it.
 */
export function ProgressRing({ done, total, locale = "en", size = 56 }: { done: number; total: number; locale?: Locale; size?: number }) {
  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <span className="nf-pring" style={{ inlineSize: size, blockSize: size }} aria-hidden="true">
      <svg viewBox="0 0 56 56">
        <circle className="nf-pring__track" cx="28" cy="28" r="24" />
        <circle
          className="nf-pring__arc"
          cx="28"
          cy="28"
          r="24"
          pathLength={100}
          strokeDasharray={`${Math.round(share * 100)} 100`}
          data-empty={share === 0 || undefined}
        />
      </svg>
      <span className="nf-pring__count nf-numeric">
        {formatNumber(done, locale)}
        <span className="nf-pring__of">/{formatNumber(total, locale)}</span>
      </span>
    </span>
  );
}
