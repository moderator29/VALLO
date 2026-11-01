import type { CSSProperties } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { MotionReveal } from "@/components/motion/Reveal";
import {
  NO_CUSTODY_SENTENCE,
  NO_INSPECTION_FEE,
  PAYMENT_GATE_SENTENCE,
} from "@/lib/money/copy";
import { Icon3D } from "@/components/ui/Icon3D";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { SectionHead } from "./SectionHead";
import { JOURNEY_OBJECTS, LANDING_OBJECT_SIZE } from "./landing-objects";

/**
 * THE JOURNEY: Find, Inspect, Agree, Move in, as four numbered step cards
 * joined by one progress line (the founder's ruling of 29 September: no phone
 * or device frame anywhere on the landing).
 *
 * Each card carries one of the founder's 3D objects, its number on the line, the step's name,
 * a title, one sentence, and a small product fragment: the one or two labels
 * the product itself shows at that step ("Booked", "Approved by Vallo",
 * "Straight to their bank"). The fragment repeats what the sentence says, so
 * it is `aria-hidden`; the sentence carries the meaning.
 *
 * UNDER 40REM IT IS A SIDEWAYS SWIPE ROW (the founder, 29 September: "the
 * four steps must be horizontal and smaller on mobile"): compact cards about
 * three quarters of the screen wide, snapping, the next one peeking in, the
 * numbered line still across the top. Only the row scrolls, never the page.
 *
 * THE LINE FILLS AS THE READER SCROLLS, from CSS alone (landing-rooms.css):
 * from 64rem one horizontal line across the four numbers, on the list's own
 * view timeline; from 40rem to 64rem three vertical segments, number to
 * number, each filling as its own step passes through the view; under 40rem
 * the same three segments laid across, filling as the row is swiped.
 * Where the browser has no scroll timelines, and under reduced motion, the
 * line is simply drawn full. There is no script and nothing is pinned.
 *
 * THE MONEY SENTENCES ARE THE CONSTANTS. Inspect prints `NO_INSPECTION_FEE`,
 * Agree prints `PAYMENT_GATE_SENTENCE` and Move in prints
 * `NO_CUSTODY_SENTENCE`, verbatim from `lib/money/copy.ts`. No fragment
 * carries money copy of its own.
 */
/* One 3D object per step (the founder, 30 September), at one size. Each
   pops in at its stop as the line reaches it (landing-3d.css). */

type Fragment = { icon: UiIconName; label: string; tone?: "ok" };

export function Journey({ t }: { t: Dictionary }) {
  const j = t.landingRooms.journey;
  const s = j.screen;
  const bodies: Record<string, string> = {
    inspect: NO_INSPECTION_FEE,
    agree: PAYMENT_GATE_SENTENCE,
    move: NO_CUSTODY_SENTENCE,
  };
  const fragments: Record<string, Fragment[]> = {
    find: [{ icon: "search", label: s.search }],
    inspect: [
      { icon: "calendar-booking", label: s.inspection },
      { icon: "check", label: s.booked, tone: "ok" },
    ],
    agree: [
      { icon: "document", label: `${s.you} · ${s.owner}` },
      { icon: "verified", label: s.approved, tone: "ok" },
    ],
    move: [
      { icon: "check", label: s.paid, tone: "ok" },
      { icon: "wallet", label: s.theirBank },
    ],
  };
  const steps = j.steps.map((step) => ({
    key: step.key,
    label: step.label,
    title: step.title,
    body: bodies[step.key] ?? ("body" in step ? (step.body ?? "") : ""),
  }));

  return (
    <section className="nf-shell nf-room" data-chapter="journey" aria-labelledby="nf-landing-journey-title">
      <SectionHead id="nf-landing-journey-title" eyebrow={j.overline} title={j.title} lede={j.body} align="center" flourish />
      {/* Under 40rem the steps are a sideways swipe row, and this is its
          scroller: focusable and named, so a keyboard can move it (the cards
          hold no links to tab through). From 40rem nothing scrolls here. It is a
          group, never a region: a region named like its own section repeats a
          landmark role and name (axe landmark-unique), and the section is
          already the landmark. */}
      <div className="nf-steps" tabIndex={0} role="group" aria-label={j.title}>
        <span className="nf-steps__line" aria-hidden="true">
          <span className="nf-steps__fill" />
        </span>
        <MotionReveal as="ol" stagger className="nf-steps__list">
          {steps.map((step, i) => (
            <li key={step.key} className="nf-step">
              <span className="nf-step__num nf-numeric" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <article className="nf-step__card">
                <span className="nf-obj nf-step__obj" style={{ "--o3-i": i } as CSSProperties}>
                  <Icon3D classic name={JOURNEY_OBJECTS[i] ?? "search"} size={LANDING_OBJECT_SIZE.journey} />
                </span>
                <span className="nf-section-label nf-step__label">{step.label}</span>
                <h3 className="nf-step__title">{step.title}</h3>
                <p className="nf-step__body">{step.body}</p>
                <ul className="nf-step__ui" aria-hidden="true">
                  {(fragments[step.key] ?? []).map((f) => (
                    <li key={f.label} className="nf-step__chip" data-tone={f.tone}>
                      <UiIcon name={f.icon} size={16} />
                      {f.label}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </MotionReveal>
      </div>
    </section>
  );
}
