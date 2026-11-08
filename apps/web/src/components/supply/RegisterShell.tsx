"use client";

import { useState, type ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BrandIcon, type BrandIconName } from "@/design-system/icons/BrandIcon";
import { Button } from "@/components/ui/Button";
import { StepFrame } from "@/components/ui/StepFrame";
import { Surface, TYPE } from "@/components/app/Screen";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * THE FRAME EVERY SCREEN OF THE THREE REGISTRATION FORMS STANDS IN.
 *
 * Since round 3 (SW5, November 2026) it is the platform's `StepFrame`: back,
 * close, the thin progress bar, the eyebrow (the form's name), the heading,
 * one line, the screen, and Continue in the sticky foot with "Step N of M".
 * The private progress ring and step row are retired; the API is unchanged so
 * the three forms did not move. The notes below are the history of why.
 *
 * `GOVERNING-03`, `04` and `05` are twelve screens and one anatomy: a back
 * square beside the form's own name, the progress row of small filled
 * rectangles, a large heading, one supporting line, the screen's content, and
 * a single lit control at the foot. Written once here so the twelve cannot
 * drift from each other, which is the same argument `Screen.tsx` makes about
 * the rest of the product.
 *
 * ONE BACK CONTROL, AND IT MEANS THE SAME THING EVERY TIME. The renders draw a
 * chevron at the top and a second one beside the progress row; two controls
 * that do the same thing is two chances to do the wrong one. There is one, it
 * steps back through the form, and on the first screen it leaves the form. A
 * person on screen three pressing back expects screen two, and nothing else.
 * It is drawn as the platform's own back control, the bare arrow `BackButton`
 * draws on every sub-page with the same `data-nav-back` handle, and the pages
 * draw no arrow of their own (25 September 2026: the page's shared arrow
 * stood a row above this one, so the screen opened with two). The stays
 * set-up settled the same double the same way (`HostShell`'s `chromeBack`).
 *
 * THE PROGRESS ROW IS `aria-hidden`, as B1's chooser already draws it: the
 * heading says where you are and `stepOf` states it in words for anybody using
 * a screen reader, so a reader counting bars would be hearing noise.
 */

export function RegisterShell({
  formTitle,
  heading,
  sub,
  steps,
  current,
  stepOfLabel,
  backLabel,
  onBack,
  children,
  primary,
  secondary,
  error,
  closeHref = "/profile/setup",
  closeLabel = "Close",
}: {
  /** The form's own name: the step frame's eyebrow, "Register as an owner". */
  formTitle: string;
  /**
   * This screen's heading, the loudest thing on it. An empty string means the
   * confirmation screen, which carries its own heading under its object: the
   * frame then titles itself with the form's name and draws no eyebrow.
   */
  heading: string;
  sub?: string;
  steps: number;
  /** Zero based. */
  current: number;
  /** "Step 2 of 4", drawn in the frame's foot and spoken by its progress bar. */
  stepOfLabel: string;
  backLabel: string;
  onBack(): void;
  /**
   * The small glass object the top right corner used to carry. Not drawn
   * since the step frame (SW5); the prop stays so the forms that name one
   * still type-check and keep saying which object belongs to the screen.
   */
  mark?: BrandIconName;
  children: ReactNode;
  primary?: { label: string; onClick(): void; disabled?: boolean; icon?: UiIconName };
  secondary?: { label: string; onClick(): void };
  /**
   * A refusal that belongs to the whole screen rather than to one field,
   * said by the one top banner (founder, 7 November 2026) and kept as the
   * frame's visually hidden notice for a screen reader.
   */
  error?: string | null;
  /** Where the round X leaves to: the chooser the forms are opened from. */
  closeHref?: string;
  closeLabel?: string;
}) {
  /* The slide follows the way the member moved: forward from the right, back
     from the left (UX_SYSTEM section 10). */
  const [seen, setSeen] = useState(current);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  if (seen !== current) {
    setDirection(current < seen ? "back" : "forward");
    setSeen(current);
  }

  /* The frame always has a lit control: a screen with only the quiet one
     (none today) promotes it rather than drawing an empty foot. */
  const lit: { label: string; onClick(): void; disabled?: boolean } | undefined = primary ?? secondary;
  const quiet = primary ? secondary : undefined;

  return (
    /* SW5: THE STEP FRAME, full screen over the app like verification and the
       listing wizard. ONE back control, the frame's own (`onBack`), which
       steps back through the form and on the first screen leaves it. */
    <StepFrame
      overlay
      testId="register-steps"
      step={heading ? current + 1 : steps}
      total={steps}
      stepLabel={stepOfLabel}
      {...(heading ? { eyebrow: formTitle } : {})}
      title={heading || formTitle}
      {...(sub ? { subtitle: sub } : {})}
      direction={direction}
      onBack={onBack}
      backLabel={backLabel}
      closeHref={closeHref}
      closeLabel={closeLabel}
      {...(error
        ? {
            /* Said by the one banner at the top of the screen; the note stays
               for a screen reader (founder, 7 November 2026). */
            notice: <FieldProblem id="register-problem" message={error} />,
          }
        : {})}
      primary={
        lit
          ? { label: lit.label, onClick: lit.onClick, disabled: lit.disabled ?? false, testId: "register-continue" }
          : { label: backLabel, onClick: onBack }
      }
    >
      <div className="nf-flow-step">{children}</div>
      {/* The quiet second way ("Back to home" on the confirmation) sits under
          the content, full width: beside the lit control in the foot the two
          labels did not fit a 360px phone. */}
      {quiet ? (
        <Button variant="quiet" size="md" full onClick={quiet.onClick} data-testid="register-secondary">
          {quiet.label}
        </Button>
      ) : null}
    </StepFrame>
  );
}

/**
 * THE CALM EXPLANATORY PANEL, which appears on almost every screen in the set.
 *
 * B1 wrote `.nf-calmpanel` for the chooser and this is the same object with a
 * caller-chosen glyph, so the two surfaces cannot drift apart. The glyph is
 * round and that is not an exception: a bare glyph on a tint is a shape rather
 * than a control, and the shape law says so in as many words.
 */
export function CalmPanel({
  icon = "info",
  title,
  body,
}: {
  icon?: UiIconName;
  title?: string;
  body: string;
}) {
  return (
    <div className="nf-calmpanel">
      <span className="nf-calmpanel__glyph" aria-hidden="true">
        <UiIcon name={icon} size="sm" />
      </span>
      <span className="min-w-0 flex-1">
        {title ? <span className={`block ${TYPE.rowTitle}`}>{title}</span> : null}
        <span className={`${title ? "mt-inline-tight " : ""}block ${TYPE.rowMeta}`}>{body}</span>
      </span>
    </div>
  );
}

/**
 * ONE OF THE THREE LINES ON A CONFIRMATION SCREEN.
 *
 * The tick plate is a small rounded RECTANGLE and deliberately NOT the
 * circular `verified-badge`. That mark is the platform's trust mark and it
 * means a human checked somebody; a list of things that are about to happen
 * has not been checked by anybody and may not borrow it.
 */
export function NextRow({ children }: { children: ReactNode }) {
  return (
    <li className="nf-nextrow">
      <span className="nf-nextrow__tick" aria-hidden="true">
        <UiIcon name="arrow-right" size={12} />
      </span>
      <span className={`min-w-0 flex-1 ${TYPE.body}`}>{children}</span>
    </li>
  );
}

/**
 * THE CONFIRMATION SCREEN, which all three forms end on.
 *
 * The object standing on its pool of brand light, the heading, one line, the
 * three things that happen next, and the honest timing label. The object is a
 * `BrandIcon`, the pool is `.nf-regobject`'s own wash, and neither carries
 * text.
 */
export function RegisterDone({
  object,
  heading,
  sub,
  filedLine,
  whatNext,
  lines,
  timing,
  note,
  children,
}: {
  object: BrandIconName;
  heading: string;
  sub: string;
  /** "Filed as VL-AGT-00001", already interpolated by the caller. */
  filedLine: string;
  whatNext: string;
  lines: readonly string[];
  /** "Usually two working days". A rectangle, never a capsule: see the CSS. */
  timing: string;
  /** One extra sentence this particular registration owes the person. */
  note?: string | null;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="nf-regobject">
        <BrandIcon name={object} size={128} priority />
      </div>

      <h2 className={`mt-heading text-center ${TYPE.display}`}>{heading}</h2>
      <p className={`mt-inline-tight text-center ${TYPE.bodyLg}`}>{sub}</p>

      {/* The reference is the loudest thing after the heading, because it is
          what support asks for. It is set in the numeral face for the same
          reason every other identifier in this product is. */}
      <p className="mt-group text-center font-[family-name:var(--nf-font-numeric)] text-[length:var(--nf-text-h4)] font-semibold text-[var(--nf-content-primary)]">
        {filedLine}
      </p>

      <Surface tone="glass" className="mt-section-tight">
        <h3 className={TYPE.sectionTitle}>{whatNext}</h3>
        <ul className="mt-group grid gap-group">
          {lines.map((line) => (
            <NextRow key={line}>{line}</NextRow>
          ))}
        </ul>
      </Surface>

      {note ? <CalmPanel body={note} /> : null}

      <p className="mt-heading">
        <span className="nf-marklabel">
          <UiIcon name="history" size={16} />
          {timing}
        </span>
      </p>

      {children}
    </>
  );
}
