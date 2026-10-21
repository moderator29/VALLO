"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import type { Locale } from "@vallo/i18n/core";
import { Sheet } from "@/components/ui/Sheet";
import { Amount } from "@/components/ui/Amount";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon3D } from "@/components/ui/Icon3D";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { feedback, type FeedbackKind } from "@/lib/ui/feedback";
import { motionQuiet } from "@/lib/motion/gate";
import { useCopyFlash, useCopyLabels } from "@/lib/ui/use-copy";
import { SUCCESS_FEEL, VARIANT_OBJECT, type SuccessVariant } from "@/lib/ui/success-moments";

/**
 * THE "IT WORKED" MOMENT (docs/SUCCESS_MOMENTS.md).
 *
 * Founder reference 54 (30 September 2026,
 * `docs/design/references/2026-09-29/54-success-pin-set.jpg`) and reference
 * 7037 (6 October): the whole screen, a big object in the middle, a title and
 * one line under it, the amount and who it was for beneath, and one
 * full-width action at the foot (a rounded rectangle, D2). Drawn in our own
 * hand: the soft top (section 17), one of the founder's 3D objects instead of
 * a flat badge, on a radial wash inside a soft halo ring, with a tick seal
 * that lands on it when the news is finished.
 *
 * TWO SHAPES, ONE BODY.
 *
 *   SuccessSheet    a dialog over whatever the person was doing. On a phone
 *                   it fills the screen; from 40rem up it is a centred card
 *                   over the dimmed page. Everything else is `Sheet`'s: the
 *                   portal, focus trap and return, Escape, Back, scroll lock.
 *   SuccessScreen   the same moment as a page's own content, for a route
 *                   whose whole job is to say it worked. Not a dialog.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS FOR, AND WHAT IT IS NOT FOR.
 *
 * Good news only. `ResultSheet` keeps every other state: pending, in review
 * with a horizon, failed, expired. A payment is celebrated here only once the
 * server settled it against the booking on screen; "Confirming your payment"
 * is never this component, and there is no prop that makes it one. Small
 * saves (saved, copied) keep their quiet toasts.
 *
 * ---------------------------------------------------------------------------
 * MOTION 13, THE FULL-SCREEN SUCCESS (north star 7.1, MOTION_SYSTEM section
 * 2 "payoff moments"; app/css/success.css). Sharp, then settled:
 *
 *   0 to 620ms     a radial wash opens behind the object, and the object
 *                  scales in over it (`land`, 620ms)
 *   at 620ms       the payoff: a tick seal lands on the object with the one
 *                  permitted pop (1.0 to 1.04 to 1.0 over 180ms), one ring
 *                  goes out from it, and ONE haptic is felt, at that moment
 *                  and not on open, so the hand and the eye agree
 *   380 to 920ms   the title, the line, the amount, the facts and the actions
 *                  rise in, 60ms apart, so the amount and the counterparty
 *                  are read beneath the object as it settles
 *
 * Nothing after that moves. The sparks and the five-breath float the first
 * version carried are gone: the motion system allows the pop for confirm,
 * verify, unlock, release and earn and nothing else (principle 5), allows
 * one warm spark per screen where they drew three, and lets nothing loop but
 * the aurora and the assistant. A moment that keeps moving after it has said
 * "done" is decoration, and decoration on a money screen reads as a game.
 *
 * THE TICK IS ONLY WHERE THE WORDS ARE FINISHED. A submission waits on a
 * person, so the "submitted" variant lands its object with no seal and no
 * pop: the picture never claims more than the words.
 *
 * MONEY ARRIVES HERE ONLY AFTER THE SERVER. The caller opens this once a
 * settlement against the record on screen came back (PaymentReturn, the pay
 * panels): there is no prop that turns "Confirming your payment" into this
 * component, and the amount shown is the amount the settlement recorded. The
 * figure itself never counts: it states money that has already moved.
 *
 * Transform and opacity only, on five elements. Under `prefers-reduced-
 * motion`, or the app's Calm or Off setting (`motionQuiet`), the moment lands
 * in its final state, the haptic is felt at once, and nothing moves. The
 * stylesheet answers the same conditions on its own, so a first paint before
 * this script runs is never the animated one.
 *
 * ---------------------------------------------------------------------------
 * ACCESSIBILITY.
 *
 * The sheet is a real dialog named by the title; the screen carries the
 * title as its heading. The line is announced through a polite live region
 * filled one frame after opening, because a live region that arrives already
 * full is not announced by every reader. In the sheet, focus goes to the
 * primary action; the screen is a page and leaves focus where a page does.
 * The object is decorative: the words say everything.
 */

export type SuccessDetail = {
  label: string;
  value: ReactNode;
  /** A reference: monospaced, selectable in one tap, never truncated. */
  mono?: boolean;
};

export type SuccessAction = {
  label: string;
  /** Navigate. The sheet closes as it goes. */
  href?: string;
  /** Runs, then the sheet closes. With neither, the action only closes. */
  onClick?: () => void;
};

/** What a moment says and shows, whichever shape it takes. */
export type SuccessMomentProps = {
  variant?: SuccessVariant;
  /**
   * The 3D object in the middle (`successCopy(...).object` names the right
   * one for a moment). Defaults by variant.
   */
  object?: Icon3DName;
  title: string;
  body: string;
  /** The headline figure for a money moment. */
  amount?: { minorUnits: number; currency?: string; locale?: Locale };
  /** The facts worth screenshotting: reference, date, the property. */
  details?: readonly SuccessDetail[];
  /** Usually "Continue". */
  primary: SuccessAction;
  secondary?: SuccessAction;
  /**
   * What the moment feels like in the hand (lib/ui/feedback.ts, which reaches
   * Capacitor's Haptics in the native shell). Defaults by variant; `false`
   * for a moment re-shown from a link, where nothing just happened.
   */
  haptic?: FeedbackKind | false;
  testId?: string;
};

export type SuccessSheetProps = SuccessMomentProps & {
  open: boolean;
  onOpenChange(open: boolean): void;
};

/**
 * When the object has landed and the payoff plays: the `deliberate` token,
 * 620ms, which success.css uses for the same moment. One number, two readers.
 */
export const PAYOFF_MS = 620;

/**
 * Decided once per showing, a frame in, so a setting changed mid-animation
 * does not snap the object between states; and the live region is filled on
 * the same frame so it is announced. The haptic is felt once per showing.
 */
export function useMomentState(shown: boolean, variant: SuccessVariant, haptic: FeedbackKind | false | undefined) {
  const [quiet, setQuiet] = useState(true);
  const [announced, setAnnounced] = useState(false);

  const [prevShown, setPrevShown] = useState(shown);
  if (prevShown !== shown) {
    setPrevShown(shown);
    setAnnounced(false);
  }

  useEffect(() => {
    if (!shown) return;
    const id = window.requestAnimationFrame(() => {
      setQuiet(motionQuiet());
      setAnnounced(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [shown]);

  const feel = haptic === false ? null : (haptic ?? SUCCESS_FEEL[variant]);
  /* ONE haptic, felt when the seal lands (PAYOFF_MS) rather than when the
     sheet opens: the hand is told "done" at the instant the eye is. A quiet
     reader sees the final state at once, so they feel it at once. */
  useEffect(() => {
    if (!shown || !feel) return;
    const delay = motionQuiet() ? 0 : PAYOFF_MS;
    const id = window.setTimeout(() => feedback(feel), delay);
    return () => window.clearTimeout(id);
  }, [shown, feel]);

  return { quiet, announced };
}

export function SuccessSheet({
  open,
  onOpenChange,
  variant = "success",
  haptic,
  testId = "success-sheet",
  ...moment
}: SuccessSheetProps) {
  const primaryRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const { quiet, announced } = useMomentState(open, variant, haptic);
  const close = () => onOpenChange(false);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={moment.title}
      hideTitle
      card
      className="nf-success-card"
      initialFocus={primaryRef}
      testId={testId}
    >
      <SuccessBody
        {...moment}
        variant={variant}
        layout="sheet"
        quiet={quiet}
        announced={announced}
        onDone={close}
        primaryRef={primaryRef}
      />
    </Sheet>
  );
}

/**
 * The page shape: the same moment as a route's own content. The title is the
 * page's heading. An action with neither `href` nor `onClick` does nothing
 * here, since there is no sheet to close, so give each one somewhere to go.
 */
export function SuccessScreen({
  variant = "success",
  haptic,
  testId = "success-screen",
  ...moment
}: SuccessMomentProps) {
  const primaryRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  /* No focus is moved: a page is read from its top, like any other page. */
  const { quiet, announced } = useMomentState(true, variant, haptic);

  return (
    <section className="nf-success-screen" data-testid={testId} aria-labelledby={`${testId}-title`}>
      <SuccessBody
        {...moment}
        variant={variant}
        layout="page"
        quiet={quiet}
        announced={announced}
        onDone={() => undefined}
        primaryRef={primaryRef}
        titleId={`${testId}-title`}
      />
    </section>
  );
}

/**
 * The body on its own, for a container that was already on screen before the
 * news arrived: the pay stage (components/app/payments/PaymentStage.tsx)
 * turns its processing face into this one in place. `staged` tells the
 * stylesheet what was already there (the halo, the amount), so those hold
 * still while the rest of the payoff plays around them.
 */
export function SuccessBody({
  variant,
  object,
  title,
  body,
  amount,
  details,
  primary,
  secondary,
  layout,
  quiet,
  announced,
  onDone,
  primaryRef,
  titleId,
  staged = false,
}: Omit<SuccessMomentProps, "haptic" | "testId"> & {
  variant: SuccessVariant;
  layout: "sheet" | "page";
  staged?: boolean;
  quiet: boolean;
  announced: boolean;
  onDone(): void;
  primaryRef: Ref<HTMLButtonElement | HTMLAnchorElement | null>;
  titleId?: string;
}) {
  const liveId = useId();
  const run = (action: SuccessAction) => () => {
    action.onClick?.();
    onDone();
  };

  return (
    <div
      className="nf-success"
      data-variant={variant}
      data-layout={layout}
      data-quiet={quiet ? "true" : "false"}
      data-staged={staged || undefined}
    >
      <div className="nf-success__stage">
        <SuccessObject name={object ?? VARIANT_OBJECT[variant]} sealed={variant !== "submitted"} />

        <div className="nf-success__words">
          {layout === "page" ? (
            <h1 id={titleId} className="nf-success__title" data-testid="success-title">
              {title}
            </h1>
          ) : (
            /* The title is the dialog's own name (Sheet's hidden heading),
               which a reader announces as focus lands. Drawn for the eye only,
               so it is not read a second time. */
            <p className="nf-success__title" data-testid="success-title" aria-hidden="true">
              {title}
            </p>
          )}
          {/* The line is the news, announced politely once it is filled, a
              frame after opening; until then it is laid out and silent, so
              nothing jumps. */}
          <p id={liveId} role="status" aria-live="polite" aria-atomic="true" className="nf-success__body">
            {announced ? body : <span aria-hidden="true">{body}</span>}
          </p>
        </div>

        {amount ? (
          <p className="nf-success__amount nf-numeric" data-testid="success-amount">
            <Amount
              minorUnits={amount.minorUnits}
              currency={amount.currency}
              locale={amount.locale}
              showFraction
              secondaryClassName="nf-money-kobo"
            />
          </p>
        ) : null}

        {details && details.length > 0 ? (
          <dl className="nf-success__facts">
            {details.map((row) => (
              <div key={row.label} className="nf-success__fact">
                <dt>{row.label}</dt>
                {row.mono && typeof row.value === "string" ? (
                  <CopyFact value={row.value} label={row.label} />
                ) : (
                  <dd className={row.mono ? "nf-success__mono" : undefined}>{row.value}</dd>
                )}
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="nf-success__actions">
        <ActionButton action={primary} tone="primary" onDone={onDone} run={run} ref={primaryRef} />
        {secondary ? <ActionButton action={secondary} tone="quiet" onDone={onDone} run={run} /> : null}
      </div>
    </div>
  );
}

function ActionButton({
  action,
  tone,
  onDone,
  run,
  ref,
}: {
  action: SuccessAction;
  tone: "primary" | "quiet";
  onDone(): void;
  run(action: SuccessAction): () => void;
  ref?: Ref<HTMLButtonElement | HTMLAnchorElement | null>;
}) {
  const variant = tone === "primary" ? "primary" : "ghost";
  const testId = tone === "primary" ? "success-primary" : "success-secondary";
  if (action.href) {
    return (
      <ButtonLink
        ref={ref as Ref<HTMLAnchorElement>}
        href={action.href}
        variant={variant}
        size="lg"
        full
        data-testid={testId}
        onClick={() => {
          action.onClick?.();
          onDone();
        }}
      >
        {action.label}
      </ButtonLink>
    );
  }
  return (
    <Button ref={ref as Ref<HTMLButtonElement>} variant={variant} size="lg" full data-testid={testId} onClick={run(action)}>
      {action.label}
    </Button>
  );
}

/* ----------------------------------------------------------- the object */

/**
 * The object on its wash, and the seal. Decorative: the words say all of it.
 *
 * Three layers, each with one job in the motion (success.css): the WASH, a
 * radial ground that opens behind the object and says "here"; the OBJECT,
 * which scales in over it; and the SEAL, a tick on a brand disc at the
 * object's lower right, which is the one thing that pops. The seal is drawn
 * only when the moment is finished news (`sealed`): a submission waits on a
 * person, and a tick there would claim what the words do not.
 */
function SuccessObject({ name, sealed }: { name: Icon3DName; sealed: boolean }) {
  return (
    <div className="nf-success__mark" aria-hidden="true" data-object={name} data-sealed={sealed ? "true" : "false"}>
      <span className="nf-success__wash" />
      <span className="nf-success__halo" />
      <span className="nf-success__pop">
        <span className="nf-success__payoff">
          <Icon3D name={name} size={144} className="nf-success__object" priority />
          {sealed ? (
            <span className="nf-success__seal">
              <UiIcon name="check" size={20} />
            </span>
          ) : null}
        </span>
      </span>
      <span className="nf-success__pulse" />
    </div>
  );
}

/**
 * A reference row: the reference itself, still selectable in one tap, and a
 * small Copy control beside it (the one copy path, `useCopyFlash`: the button
 * says Copied for a beat and a light tick is felt). Outside the client copy
 * provider there are no words for the control, so only the reference shows.
 */
function CopyFact({ value, label }: { value: string; label: string }) {
  const words = useCopyLabels();
  const [copied, copy] = useCopyFlash();
  return (
    <dd className="flex flex-wrap items-center justify-end gap-inline">
      <span className="nf-success__mono">{value}</span>
      {words ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon="document"
          done={copied}
          onClick={() => void copy(value)}
          aria-label={`${words.copy}: ${label}`}
          data-testid="success-copy"
        >
          {copied ? words.copied : words.copy}
        </Button>
      ) : null}
    </dd>
  );
}
