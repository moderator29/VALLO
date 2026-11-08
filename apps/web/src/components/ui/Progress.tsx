import { intlTag, type Locale } from "@vallo/i18n/core";
import type { CSSProperties } from "react";

/**
 * Progress.
 *
 * `role="progressbar"` appeared ZERO times in this codebase. Every bar on the
 * platform was a decorative div whose width happened to change, which means
 * assistive technology was told nothing at all about how far along an upload,
 * a wizard or a verification was - and a user who cannot see the bar was left
 * with a screen that appeared to do nothing for the whole operation.
 *
 * There were also no animated fills. A width that jumps between renders reads
 * as a redraw; a width that travels reads as progress being made. The travel is
 * the entire communicative content of the control.
 *
 * And of the four multi-step flows, exactly one had a step bar. Checkout and
 * onboarding - the two that most need to answer "how much more of this is
 * there" - had nothing.
 */

export type ProgressTone = "brand" | "success" | "warning" | "danger";

/**
 * Fills are tokens, not literals, so a tone change happens once. `brand` uses
 * the gradient because a progress fill is the one place a gradient reads as
 * motion rather than decoration.
 */
const TONE_FILL: Record<ProgressTone, string> = {
  brand: "var(--nf-gradient-brand)",
  success: "var(--nf-state-success)",
  warning: "var(--nf-state-warning)",
  danger: "var(--nf-state-error)",
};

const TRACK: CSSProperties = {
  background: "color-mix(in oklab, var(--nf-content-primary) 12%, transparent)",
};

/** 6 / 10px. Taller than 10 stops reading as a rule and starts reading as a bar
 *  chart, which is a different claim about the data. */
const TRACK_HEIGHT = { sm: "h-1.5", md: "h-2.5" } as const;

export type ProgressProps = {
  /** Ignored when `indeterminate`. Clamped, so a bad value cannot overflow. */
  value?: number;
  max?: number;
  /** The accessible name. Required: an unnamed progressbar announces a number
   *  with no subject. */
  label: string;
  /**
   * Puts the value on the bar, riding the leading edge of the fill - reference
   * 6's "85%" sitting on top of the column.
   */
  showValue?: boolean;
  /**
   * Overrides the rendered value text with a caller-supplied, already-localised
   * string ("3 of 7", "2.4 MB of 8 MB"). Without it the value is formatted as a
   * percentage in the given locale; a hardcoded English phrase here would be
   * the one untranslated string in a translated flow.
   */
  valueText?: string;
  locale?: Locale;
  tone?: ProgressTone;
  size?: keyof typeof TRACK_HEIGHT;
  /** For work whose duration is unknown. Drops `aria-valuenow`, which is
   *  precisely how indeterminate progress is expressed. */
  indeterminate?: boolean;
  /**
   * `glass` is the inspection checklist's bar: a sunken glass track with the
   * hairline and a fill lit at its leading edge. The default track is the
   * content wash every existing bar draws.
   */
  material?: "default" | "glass";
  className?: string;
};

export function Progress({
  value = 0,
  max = 100,
  label,
  showValue = false,
  valueText,
  locale = "en",
  tone = "brand",
  size = "md",
  indeterminate = false,
  material = "default",
  className,
}: ProgressProps) {
  const glass = material === "glass";
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const ratio = clamped / safeMax;
  const pct = ratio * 100;

  const text =
    valueText ??
    new Intl.NumberFormat(intlTag[locale], {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(ratio);

  return (
    <div className={["w-full", className ?? ""].filter(Boolean).join(" ")}>
      {showValue && !indeterminate ? (
        /*
         * The value rides ABOVE the fill's leading edge rather than inside it.
         * Inside looks better in a mock at 60% and is unreadable at 4%, where
         * the fill is narrower than the text - and the low values are exactly
         * when a user is looking hardest. Riding above works at every value.
         *
         * The translate flips from -100% to 0 near the ends so the label never
         * overhangs the track it belongs to.
         */
        <div className="relative mb-2xs h-4 w-full overflow-x-clip" aria-hidden="true">
          {/* A full-width rail translated by the value (a percentage of its
              own width is a percentage of the track), carrying the label, so
              the label travels on transform rather than on `left`. */}
          <span
            className="absolute inset-x-0 top-0 block transition-transform motion-reduce:transition-none"
            style={{
              transform: `translateX(${pct}%)`,
              transitionDuration: "var(--nf-duration-slow)",
              transitionTimingFunction: "var(--nf-ease-entrance)",
            }}
          >
            <span
              className="nf-numeric absolute left-0 top-0 whitespace-nowrap text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-secondary)]"
              style={{ transform: `translateX(${pct < 12 ? "0%" : pct > 88 ? "-100%" : "-50%"})` }}
            >
              {text}
            </span>
          </span>
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : safeMax}
        aria-valuenow={indeterminate ? undefined : clamped}
        aria-valuetext={indeterminate ? undefined : text}
        className={[
          "w-full overflow-hidden rounded-pill",
          TRACK_HEIGHT[size],
          /*
           * Indeterminate borrows `.nf-skeleton`'s sweep. A looping animation
           * needs `@keyframes`, this primitive may not add any, and the sweep is
           * the right picture anyway: lit movement with no destination reads as
           * "working, duration unknown". It also inherits the reduced-motion
           * stop that rule already carries, so the loop stops for anyone who
           * asked for less motion.
           */
          indeterminate ? "nf-skeleton" : "",
          glass && !indeterminate ? "nf-progress--glass" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={indeterminate || glass ? undefined : TRACK}
      >
        {indeterminate ? null : (
          <span
            className={[
              "nf-progress__fill block h-full rounded-pill transition-transform motion-reduce:transition-none",
              glass ? "nf-progress__fill--lit" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            /* The brand fill's leading edge is the warm spark (D81, spark.css). */
            data-tone={tone}
            style={{
              /* The fill is the track's width and slides in from the left: the
                 track's rounded clip draws the same bar a growing width drew,
                 on transform rather than a layout per frame. */
              transform: `translateX(${pct - 100}%)`,
              background: TONE_FILL[tone],
              transitionDuration: "var(--nf-duration-slow)",
              /* Entrance easing, not linear: the fill should arrive and settle
                 rather than stop dead, which is what makes it read as physical. */
              transitionTimingFunction: "var(--nf-ease-entrance)",
            }}
          />
        )}
      </div>
    </div>
  );
}

export type SegmentedProgressProps = {
  /** Total steps in the flow. */
  steps: number;
  /** The step being shown, 1-based. */
  current: number;
  /**
   * The already-localised name of the whole control, stating position: the
   * "Step 2 of 7" that a screen reader announces. Composed by the caller from
   * its dictionary - assembling it here would hardcode English word order into
   * a four-locale platform.
   */
  label: string;
  tone?: ProgressTone;
  className?: string;
};

/**
 * The wizard bar.
 *
 * Segments rather than one continuous fill because a wizard's progress is
 * countable: a user can see there are seven of these and they are on the
 * second, which a 28%-full bar does not tell them. Completed steps stay filled
 * so the flow reads as ground covered rather than a marker sliding along.
 */
export function SegmentedProgress({
  steps,
  current,
  label,
  tone = "brand",
  className,
}: SegmentedProgressProps) {
  const total = Math.max(1, Math.trunc(steps));
  const at = Math.min(Math.max(Math.trunc(current), 0), total);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={at}
      aria-valuetext={label}
      className={["flex w-full items-center gap-inline-tight", className ?? ""].filter(Boolean).join(" ")}
    >
      {Array.from({ length: total }, (_, i) => {
        const done = i < at;
        return (
          <span
            key={i}
            className="h-1.5 flex-1 overflow-hidden rounded-pill"
            style={TRACK}
          >
            {/*
              Filled by scaling from the leading edge rather than animating
              width, so the browser can run it on the compositor - a wizard bar
              animates at the exact moment the next step's content is mounting,
              which is the worst possible time to ask for a layout pass.
            */}
            <span
              className="block h-full origin-left rounded-pill transition-transform motion-reduce:transition-none"
              style={{
                background: TONE_FILL[tone],
                transform: `scaleX(${done ? 1 : 0})`,
                transitionDuration: "var(--nf-duration-base)",
                transitionTimingFunction: "var(--nf-ease-entrance)",
                /* The step in progress carries a faint glow so "where I am" is
                   distinguishable from "where I have been" at a glance. */
                boxShadow:
                  i === at - 1
                    ? "0 0 12px var(--nf-glow-3)"
                    : undefined,
              }}
            />
          </span>
        );
      })}
    </div>
  );
}
