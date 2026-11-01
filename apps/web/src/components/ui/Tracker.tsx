import Link from "next/link";
import type { ReactNode } from "react";
import "./tracker.css";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { glyphSrc, type GlyphName } from "@/design-system/icons/glyphs";
import type { StatusTone } from "@/components/ui/StatusPill";
import type { TrackStep } from "@/components/app/status/StatusTrack";
import type { TrackState } from "@/components/app/status/tracks";

/**
 * THE ONE TRACKER (ONE-PRODUCT-DECISIONS, recommendation 1; the founder's
 * `status-tracking-timeline.jpg`, 7 October 2026).
 *
 * Everything in Vallo that moves through steps with a wait (a deal, an
 * inspection, a booking, a verification, a dispute) is shown the same way:
 *
 *   THE STATUS CARD   a chip naming what this is, the status in words as the
 *                     biggest thing, when it got there, and two cells: what
 *                     happens next and whether the reader must act ("No action
 *                     needed from you" when that is true).
 *   THE TIMELINE      the moments that have happened, newest first: the date
 *                     on the left, a round glyph node on a spine, the step and
 *                     one muted line. Steps still ahead are not drawn as if
 *                     they had dates; the next one is named in the card.
 *
 * It draws and decides nothing. Steps arrive from `components/app/status/
 * tracks.ts` (the same models `StatusTrack` draws) with their state worked
 * out and their time formatted by the page, which knows the locale. A step
 * with no recorded time shows no date: a date is never invented.
 *
 * Colour is never the only signal: each node carries its state's glyph
 * (a tick, an hourglass, a cross), and each step its state in words for a
 * screen reader.
 *
 * Server-safe. `TrackerBar` is the floating foot (a message circle and one
 * capsule action), for the pages that have both.
 */

export type TrackerCell = { label: string; value: string };

export type TrackerProps = {
  /** What this is, on the card's chip ("Agreement", "Booking"). Also the timeline's accessible name prefix. */
  label: string;
  icon?: UiIconName;
  /** The founder's glyph for this state, drawn bare beside the title. */
  glyph?: GlyphName;
  /** The status in words: the biggest thing on the card. */
  title: string;
  tone: StatusTone;
  /** "Submitted 21 Sep, 10:42": pre-formatted, from a real time only. */
  since?: string | null;
  /** At most two: what happens next, and whether the reader must act. */
  cells?: readonly TrackerCell[];
  /** The record's steps, oldest first, as `tracks.ts` builds them. */
  steps: readonly TrackStep[];
  /** The timeline's heading ("Timeline"). */
  timelineLabel: string;
  /** A quiet note at the timeline's right, from real data only. */
  timelineAside?: string | null;
  /** A glyph per step key, where the step has its own (sent, signed, paid). */
  glyphs?: Partial<Record<string, UiIconName>>;
  /** The state words a screen reader hears beside each step. */
  spoken?: Partial<Record<TrackState, string>>;
  /** The visible line under the step in progress when it has no note of its own ("In progress"). */
  currentNote?: string;
  className?: string;
  testId?: string;
};

const STATE_GLYPH: Record<TrackState, UiIconName> = {
  done: "check",
  current: "hourglass",
  upcoming: "clock",
  failed: "close",
};

const SPOKEN: Record<TrackState, string> = {
  done: "done",
  current: "in progress",
  upcoming: "not yet",
  failed: "stopped here",
};

export function Tracker({
  label,
  icon = "clock",
  glyph,
  title,
  tone,
  since,
  cells,
  steps,
  timelineLabel,
  timelineAside,
  glyphs,
  spoken,
  currentNote = "In progress",
  className,
  testId,
}: TrackerProps) {
  /* What has happened, newest first. The future is the card's "next" cell. */
  const moments = steps.filter((s) => s.state !== "upcoming").slice().reverse();
  const words = { ...SPOKEN, ...spoken };
  return (
    <section
      className={className ? `nf-tracker ${className}` : "nf-tracker"}
      data-tone={tone}
      aria-label={`${label}: ${title}`}
      data-testid={testId}
    >
      <div className="nf-tracker__status">
        <span className="nf-tracker__chip">
          <UiIcon name={icon} size={16} />
          {label}
        </span>
        <div className="nf-tracker__card">
          <div className="nf-tracker__titleline">
            {glyph ? (
              // eslint-disable-next-line @next/next/no-img-element -- a 256px transparent glyph at 48px
              <img src={glyphSrc(glyph)} alt="" width={48} height={48} decoding="async" className="nf-tracker__glyph" aria-hidden="true" />
            ) : null}
            <p className="nf-tracker__title" data-testid={testId ? `${testId}-title` : undefined}>
              {title}
            </p>
          </div>
          {since ? <p className="nf-tracker__since">{since}</p> : null}
          {cells && cells.length > 0 ? (
            <dl className="nf-tracker__cells">
              {cells.slice(0, 2).map((cell) => (
                <div key={cell.label} className="nf-tracker__cell">
                  <dt>{cell.label}</dt>
                  <dd>{cell.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>

      {moments.length > 0 ? (
        <div className="nf-tracker__timeline">
          <div className="nf-tracker__head">
            <h3 className="nf-tracker__heading">{timelineLabel}</h3>
            {timelineAside ? <span className="nf-tracker__aside">{timelineAside}</span> : null}
          </div>
          <ol className="nf-tracker__list">
            {moments.map((step) => (
              <li
                key={step.key}
                className="nf-tracker__step"
                data-state={step.state}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                <span className="nf-tracker__date">{step.when ?? ""}</span>
                <span className="nf-tracker__node" aria-hidden="true">
                  <UiIcon name={glyphs?.[step.key] ?? STATE_GLYPH[step.state]} size={16} />
                </span>
                <span className="nf-tracker__text">
                  <span className="nf-tracker__what">
                    {step.label}
                    <span className="sr-only">, {words[step.state]}</span>
                  </span>
                  {step.note || step.state === "current" ? (
                    <span className="nf-tracker__note">{step.note || currentNote}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The tracker's floating foot: a round message control and one capsule
 * action. Only for a page that has both a conversation and a next step; a
 * page with neither draws no bar rather than an empty one.
 */
export function TrackerBar({
  messageHref,
  messageLabel,
  children,
}: {
  messageHref?: string | null;
  messageLabel: string;
  /** The one capsule action (a `ButtonLink` or `Button`). */
  children?: ReactNode;
}) {
  if (!messageHref && !children) return null;
  return (
    <div className="nf-tracker-bar" data-testid="tracker-bar">
      {messageHref ? (
        <Link href={messageHref} className="nf-tracker-bar__message" aria-label={messageLabel}>
          <UiIcon name="chat-bubble" size={20} />
        </Link>
      ) : null}
      {children ? <div className="nf-tracker-bar__action">{children}</div> : null}
    </div>
  );
}
