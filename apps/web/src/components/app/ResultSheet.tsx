"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Locale } from "@vallo/i18n/core";
import { Sheet } from "@/components/ui/Sheet";
import { Amount } from "@/components/ui/Amount";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { IconPlate, ICON_PLATE_GLYPH, type IconPlateTone } from "@/components/ui/IconPlate";
import { feedback, type FeedbackKind } from "@/lib/ui/feedback";

/**
 * One confirmation, for every flow.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT REPLACES, AND WHY THERE WERE NINE OF THEM.
 *
 * Every flow on this platform wrote its own moment. Nine bespoke confirmation
 * screens, each choosing its own mark, its own variant and its own copy, and
 * they disagreed: `MomentVariant` was `success | brand | warning` with no
 * failure at all, so EIGHT failure surfaces were painted
 * `--nf-state-warning`, which resolves to `--nf-cyan-400`, which is the exact
 * token `--nf-status-pending` is defined as. A crash, a cancelled booking and
 * a declined payment were drawn in the colour this product reserves for "we
 * are still working on it". Two of them used `calendar-check`, a TICK, to say
 * "This booking was cancelled" and "We could not find that booking".
 *
 * ---------------------------------------------------------------------------
 * WHY A SHEET AND NOT A SCREEN.
 *
 * `MomentScreen` renders inline in the document flow at `min-height: 60vh`
 * with `justify-content: center`. On checkout that puts the confirmation for a
 * payment BELOW the booking summary, so a person who has just paid 1.2m naira
 * scrolls to find out whether it worked. A moment you scroll to is not a
 * moment. A confirmation arrives over the top of what you were doing, and the
 * thing you were doing is still there underneath when it leaves.
 *
 * `components/ui/Sheet.tsx` already owns the portal, the spring, the detents,
 * the drag, the focus trap, the counted scroll lock, Escape, focus
 * restoration, the safe-area inset and the reduced-motion branch. This
 * composes it and writes none of that again.
 *
 * ---------------------------------------------------------------------------
 * THE ONE RULE THE TYPE SYSTEM ENFORCES.
 *
 * `consequence` is REQUIRED on `pending`, `review` and `failed` and optional
 * everywhere else, through a discriminated union rather than a comment. It is
 * the line that removes fear - "this usually takes a few seconds; if it takes
 * longer, your money has not moved" - and it is the line every product skips.
 * A call site cannot ship a pending sheet with no horizon, which is the same
 * trick `KycStatus` already uses to make a reason mandatory on a rejection.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 * No confetti, no counting numbers, no staggered lines. A confirmation's job
 * is to be screenshotted and sent to a landlord, an agent or a bank, and a
 * number mid-count cannot be. The mark lands, the glow fades in behind it, and
 * nothing else moves.
 */

export type ResultState =
  /** Money left the person: payment sent, transfer sent, withdrawal placed. */
  | "sent"
  /** Money arrived: funding landed, payout received, refund returned. */
  | "received"
  /** A non-money good outcome: booking confirmed, review posted, listing live. */
  | "confirmed"
  /** In flight. Nothing decided, nothing lost. */
  | "pending"
  /** A human is looking at it, with a horizon. */
  | "review"
  /** Refused, declined, reversed. Something did not happen. */
  | "failed"
  /** A window closed. Not a failure and not a success. */
  | "expired";

/**
 * The screen form also says "missing" (UI-15): the thing is not there, or not
 * yours. Neither a failure the person can act on nor good news, so it is
 * neutral: never rose, never a success mark. The sheet never shows it.
 *
 * It also says "sign-in": the page needs the person signed in before it can
 * show anything (a payment, a stay's checkout). Nothing has happened yet, so
 * it is neutral too: a lock on the neutral plate, never the brand "verified"
 * shield that `confirmed` draws (Round 3 sweep, C3).
 */
export type ResultScreenState = ResultState | "missing" | "sign-in";

export type ResultAction = {
  label: string;
  href?: string;
  /** With `href`, the click event comes too, so a failure screen can take the click over (`lib/offline/escape.ts`). */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  tone: "primary" | "quiet";
};

/** The screenshotted fact. Everything here is optional; nothing here is prose. */
export type ResultFact = {
  amountMinor?: number;
  currency?: string;
  /** The property, the person, the bank. One line, never truncated. */
  subject?: string;
  /** Date and time, already formatted in the viewer's locale. */
  at?: string;
  /** The string support traces it by. Full, selectable, never truncated. */
  reference?: string;
};

type Common = {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Two words. "Payment sent". Never an exclamation mark. */
  verdict: string;
  fact?: ResultFact;
  locale?: Locale;
  /** At most two. The tuple is what enforces it. */
  actions?: readonly [ResultAction] | readonly [ResultAction, ResultAction];
  /**
   * Kept for existing callers and no longer drawn: the mark is the state's
   * glyph on the shared `IconPlate` (SW-ST3), so the state alone decides it.
   */
  mark?: BrandIconName;
  /** Small print under the actions. A receipt link, a support route. */
  footnote?: ReactNode;
  /**
   * What the hand feels instead of the state's own (`FEEL`). For a done
   * state that is not a payoff: devices signed out is `confirmed`, and it is
   * a security step, not good news, so it feels as the commit it was.
   */
  haptic?: FeedbackKind | null;
};

export type ResultSheetProps = Common &
  (
    | {
        /** The three states where a person is owed a horizon. */
        state: "pending" | "review" | "failed";
        /** REQUIRED here. The line that removes fear. */
        consequence: string;
        /**
         * Blocks dismissal. Legal on "pending" only, and only while the
         * outcome is genuinely unknown. Never on a failure: a person must
         * always be able to leave a screen that told them bad news.
         */
        blocking?: boolean;
      }
    | {
        state: "sent" | "received" | "confirmed" | "expired";
        consequence?: string;
        blocking?: never;
      }
  );

/**
 * The seven states, as ink and mark.
 *
 * `pending` and `review` are BOTH cyan and that is correct: they are the same
 * kind of waiting. They must not be indistinguishable, so the mark differs
 * (`hourglass` against `doc-review`) and the verdict differs. Rule 13 is
 * satisfied by mark plus word, not by hue.
 *
 * `expired` is deliberately not rose. A hold running out is not a failure and
 * painting it as one manufactures alarm.
 */
/*
 * THE MARK SITS ON THE SHARED ICON PLATE (platform sweep, SW-ST3).
 *
 * The glass marks this sheet used to draw (`seal-pending`, `payment-failed`
 * and the rest) are tile-form artwork: each arrives on its own dark rounded
 * square, so a pending or failed sheet showed a dark square behind the glass.
 * The platform's reference anatomy has one answer for "an icon on a surface",
 * `IconPlate`, with a tone per state: pending takes the pending tone, a
 * failure the error tone, a settled movement the success tone. The glyph is
 * the stroked tier, as the primitive expects.
 */
const PLATE: Record<ResultScreenState, { tone: IconPlateTone; glyph: UiIconName }> = {
  sent: { tone: "success", glyph: "arrow-up" },
  received: { tone: "success", glyph: "arrow-down" },
  confirmed: { tone: "brand", glyph: "verified" },
  pending: { tone: "pending", glyph: "history" },
  review: { tone: "pending", glyph: "history" },
  failed: { tone: "error", glyph: "close" },
  expired: { tone: "info", glyph: "history" },
  missing: { tone: "info", glyph: "search" },
  "sign-in": { tone: "neutral", glyph: "lock" },
};

function ResultPlate({ state }: { state: ResultScreenState }) {
  const plate = PLATE[state];
  return (
    <IconPlate size="lg" tone={plate.tone}>
      <UiIcon name={plate.glyph} size={ICON_PLATE_GLYPH.lg} />
    </IconPlate>
  );
}

/*
 * V-30: WHAT EACH STATE FEELS LIKE. The outcome is felt when it is known,
 * which is when this sheet opens, not when the button was pressed. `expired`
 * is felt as nothing: a window closing is neither news nor a fault.
 *
 * PENDING AND REVIEW ARE FELT AS NOTHING (CRAFT_DOCTRINE 6: "nothing in a
 * passive state ever vibrates"; one error pattern). They were a third, sharp
 * "warning" buzz for a payment that is still on its way: the hand was told
 * something had gone wrong while the words said wait. The commit was already
 * felt when it was accepted, and the outcome is felt when it arrives.
 */
const FEEL: Record<ResultState, FeedbackKind | null> = {
  sent: "success",
  received: "success",
  confirmed: "success",
  pending: null,
  review: null,
  failed: "error",
  expired: null,
};

const STATE: Record<ResultScreenState, { ink: string }> = {
  sent: { ink: "var(--nf-state-success)" },
  received: { ink: "var(--nf-state-success)" },
  confirmed: { ink: "var(--nf-brand-primary)" },
  pending: { ink: "var(--nf-state-warning)" },
  review: { ink: "var(--nf-state-warning)" },
  failed: { ink: "var(--nf-state-error)" },
  expired: { ink: "var(--nf-content-muted)" },
  missing: { ink: "var(--nf-content-muted)" },
  "sign-in": { ink: "var(--nf-content-muted)" },
};

export function ResultSheet(props: ResultSheetProps) {
  const { open, onOpenChange, state, verdict, fact, locale, actions, footnote } = props;
  const consequence = props.consequence;
  const blocking = state === "pending" && props.blocking === true;
  const tone = STATE[state];

  /*
   * FIRST FOCUS GOES TO WHAT TO DO NEXT.
   *
   * `Sheet` focuses the first focusable element in DOM order, which in the
   * wallet's drawers is the Close button, so a screen reader hears "Add money
   * to your wallet, dialog" and then "Close, button". On a confirmation the
   * first thing a keyboard or screen-reader user meets has to be the action.
   *
   * `Sheet` has no `initialFocus` prop to pass and it is not this file's to
   * add, so the focus is taken here, one frame after the sheet has mounted and
   * run its own focus. That is a seam and it is named rather than hidden.
   */
  const primaryRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => primaryRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  /* Felt once per opening, and again only if the state itself changes while
     open (pending becoming sent is a second piece of news). */
  const override = props.haptic;
  useEffect(() => {
    if (!open) return;
    const kind = override === undefined ? FEEL[state] : override;
    if (kind) feedback(kind);
  }, [open, state, override]);

  return (
    <Sheet
      open={open}
      onOpenChange={blocking ? () => undefined : onOpenChange}
      title={verdict}
      hideTitle
      detents={[0.72]}
    >
      {/*
        `nf-money` is carried INSIDE the sheet on purpose. `Sheet` renders
        through a portal on `document.body`, so it sits outside the page's
        surface root and the money surfaces' control law (the lit brand edge
        and the glow, scoped in `app/css/money-surface.css`) would stop at the
        sheet's edge: a confirmation would answer the page's own controls with
        differently dressed ones. The class travels with the content instead.

        THIS USED TO SAY "the render's capsule and its glow". There is no
        capsule any more and there is no capsule rule to inherit: the shape
        law closed at DESIGN_DIRECTION section 1.4, and the retired wallet
        sheet that recorded the rule's deletion is itself gone (C12). A
        stale comment naming a withdrawn ruling as its authority is how a
        shape law gets reopened by accident, so it is corrected rather than
        left to be read.
      */}
      <div
        className="nf-money relative flex flex-col items-center px-3xs pb-block text-center"
        style={{ "--nf-result-ink": tone.ink } as React.CSSProperties}
      >
        {/*
          ONE GLOW, BEHIND ONE OBJECT, AND NEVER ON BAD NEWS.

          It used to carry `[html[data-theme=light]_&]:hidden`, because a
          blurred coloured halo on white paper reads as a print smudge. Light
          mode was removed from the platform on 23 September 2026, so the only
          ground this glow can land on is the one it was drawn for, and a
          Tailwind variant keyed on an attribute that can never appear is dead
          weight in the class string.

          AND A FAILURE DOES NOT GLOW. Two reasons, and the first one is a hard
          rule. Rose at 26 per cent, blurred, over navy composites to a
          MAGENTA bloom, and magenta is one of the hues this brand has banned by
          name; rendered at 390px in the dark it was the most saturated thing on
          the screen and it was not blue. The second is restraint: the glow
          belongs to the primary action, to focus and to the active state, so a
          destructive or failed surface gets its colour and its weight and no
          bloom. `expired` is left unlit for the same reason in reverse: a
          window closing is the quietest thing this component says.
        */}
        {state !== "failed" && state !== "expired" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--nf-result-ink) 26%, transparent) 0%, transparent 66%)",
              filter: "blur(6px)",
            }}
          />
        )}

        {/* The mark: the state's glyph on the shared icon plate, in the
            state's tone. The glass tile artwork that stood here brought its
            own dark square (SW-ST3). */}
        <ResultPlate state={state} />

        {/* `text-wrap: balance` is what stops "Payment not / confirmed"
            orphaning its second word, which is the break the three existing
            moment titles all produce at 390px. */}
        {/* The verdict carries the state's ink on a FAILURE and the ordinary
            content ink everywhere else. With the bloom gone that is where the
            rose lives, and a failure that is rose in exactly one place is
            legible without being loud. The mark and the word carry it too, so
            a reader who sees no hue at all still gets the same answer. */}
        <p
          role={state === "failed" ? "alert" : undefined}
          className="nf-h2 mt-block max-w-[18ch] font-bold tracking-[-0.02em] [text-wrap:balance]"
          style={{
            color: state === "failed" ? "var(--nf-result-ink)" : "var(--nf-content-primary)",
          }}
        >
          {verdict}
        </p>

        {fact && (
          <div className="mt-row">
            {fact.amountMinor !== undefined && (
              <p className="nf-numeric text-[clamp(2rem,9vw,2.75rem)] font-bold leading-none tracking-[-0.03em] text-[var(--nf-content-primary)]">
                <Amount
                  minorUnits={fact.amountMinor}
                  locale={locale}
                  currency={fact.currency}
                  showFraction
                  secondaryClassName="nf-money-kobo"
                />
              </p>
            )}
            {/* Never truncated, never clamped. It wraps, because it is the
                property, the person or the bank, and half of any of those is
                worse than none. */}
            {fact.subject && (
              <p className="nf-body mt-row text-[var(--nf-content-secondary)] [overflow-wrap:anywhere]">
                {fact.subject}
              </p>
            )}
            {fact.at && <p className="nf-caption mt-inline-tight">{fact.at}</p>}
            {fact.reference && (
              <p className="nf-caption mt-inline-tight">
                <span className="text-[var(--nf-content-muted)]">Reference </span>
                {/* `user-select: all` so one tap takes the whole string, which
                    is the difference between a reference somebody can send to
                    their bank and one they have to transcribe. */}
                <span className="font-mono font-semibold text-[var(--nf-content-secondary)] [font-variant-numeric:tabular-nums] [overflow-wrap:anywhere] [user-select:all]">
                  {fact.reference}
                </span>
              </p>
            )}
          </div>
        )}

        {consequence && (
          <p className="nf-body mt-row max-w-[34ch] leading-relaxed text-[var(--nf-content-secondary)]">
            {consequence}
          </p>
        )}

        {actions && actions.length > 0 && (
          /* Stacked and full width at 390px, primary FIRST, side by side from
             640. The first attempt reversed the array so the primary would sit
             on the right in a row, and at 390px that put the quiet action above
             the primary one: the first thing under a person's thumb on a failed
             payment was "Get help" rather than "Try again". DOM order is the
             reading order and the tab order, so it stays primary first and the
             row does not reverse. Two at most, and the tuple type is what makes
             a third impossible rather than a comment asking for restraint. */
          <div className="mt-group flex w-full max-w-sm flex-col gap-row sm:flex-row sm:justify-center">
            {actions.map((action, i) => {
              const primary = action.tone === "primary";
              const ref = primary ? primaryRef : undefined;
              return action.href ? (
                <ButtonLink
                  key={action.label}
                  ref={ref as React.Ref<HTMLAnchorElement>}
                  href={action.href}
                  variant={primary ? "primary" : "ghost"}
                  full
                  onClick={action.onClick}
                >
                  {action.label}
                </ButtonLink>
              ) : (
                <Button
                  key={action.label}
                  ref={ref as React.Ref<HTMLButtonElement>}
                  type="button"
                  variant={primary ? "primary" : "ghost"}
                  full
                  onClick={action.onClick}
                  data-order={i}
                >
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}

        {footnote && (
          <div className="nf-caption mt-row text-[var(--nf-content-muted)]">{footnote}</div>
        )}
      </div>
    </Sheet>
  );
}

/**
 * The same verdict, as a whole screen rather than over one.
 *
 * ---------------------------------------------------------------------------
 * WHY BOTH SHAPES EXIST, AND WHEN EACH IS RIGHT.
 *
 * A sheet is correct when something JUST HAPPENED to a thing that is still
 * there underneath: a payment against a booking, a transfer against a wallet.
 * It arrives over the page and leaves it behind.
 *
 * These are not that. An error boundary, a booking that cannot be found and a
 * cancelled booking are the whole state of the route: there is nothing
 * underneath for a sheet to sit over, and a dismissable sheet over an empty
 * page leaves somebody looking at nothing. So they render in the flow, with
 * the same mark, the same verdict, the same consequence and the same two
 * actions as the sheet, in the same seven-state vocabulary.
 *
 * ---------------------------------------------------------------------------
 * EIGHT SURFACES WERE PAINTED IN THE PENDING COLOUR AND THIS IS WHAT THEY
 * BECOME.
 *
 * `MomentVariant` was `success | brand | warning`. There was no failure
 * variant at all, so every failure took `warning`, `.nf-moment--warning` sets
 * `--nf-moment-color: var(--nf-state-warning)`, `--nf-state-warning` is
 * defined as `var(--nf-cyan-400)`, and `--nf-status-pending` is defined as
 * `var(--nf-state-warning)`. They are not two tokens that happen to be
 * similar. They are the same value under two names, so a crash, a cancelled
 * booking and a booking that does not exist were all drawn in the colour this
 * product reserves for "still going through".
 *
 * Two of them went further and used `calendar-check`, a calendar with a TICK,
 * as the mark for "This booking was cancelled" and "We could not find that
 * booking": a success mark borrowed because it was the closest thing
 * available, saying the opposite of the sentence beside it.
 */
export function ResultScreen({
  state,
  verdict,
  consequence,
  actions,
  footnote,
  heading = false,
  "data-testid": testId,
}: {
  state: ResultScreenState;
  verdict: string;
  consequence: string;
  actions?: readonly [ResultAction] | readonly [ResultAction, ResultAction];
  /** Kept for existing callers and no longer drawn (SW-ST3). */
  mark?: BrandIconName;
  footnote?: ReactNode;
  /**
   * The verdict is the page's one h1. Off by default, because most callers sit
   * under a page that already has its own heading; a public door whose whole
   * page is this screen (a safety share, a landlord's reply link) turns it on,
   * so the page is not left without one. On a failure the alert role moves to a
   * wrapper around the heading and the sentence, since `role="alert"` on the
   * heading itself would replace its heading semantics.
   */
  heading?: boolean;
  "data-testid"?: string;
}) {
  const tone = STATE[state];
  const bad = state === "failed";
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center px-lg py-section text-center"
      style={{ "--nf-result-ink": tone.ink } as React.CSSProperties}
    >
      <ResultPlate state={state} />
      {/*
        THE VERDICT CARRIES THE STATE'S INK, which is the whole point of the
        component. `role="alert"` on a failure because nothing in this product
        announced one assertively before; a screen a person lands on after a
        crash should say so rather than wait to be read.
      */}
      {(() => {
        const Verdict = heading ? "h1" : "p";
        const words = (
          <>
            <Verdict
              role={bad && !heading ? "alert" : undefined}
              className="nf-h2 mt-block max-w-[18ch] font-bold tracking-[-0.02em] [text-wrap:balance]"
              style={{ color: bad ? "var(--nf-result-ink)" : "var(--nf-content-primary)" }}
            >
              {verdict}
            </Verdict>
            <p className="nf-body mt-row max-w-[38ch] leading-relaxed text-[var(--nf-content-secondary)]">
              {consequence}
            </p>
          </>
        );
        return bad && heading ? (
          <div role="alert" className="flex flex-col items-center">
            {words}
          </div>
        ) : (
          words
        );
      })()}
      {actions && actions.length > 0 && (
        <div className="mt-group flex w-full max-w-sm flex-col gap-row">
          {actions.map((action) =>
            action.href ? (
              <ButtonLink
                key={action.label}
                href={action.href}
                variant={action.tone === "primary" ? "primary" : "ghost"}
                full
                onClick={action.onClick}
              >
                {action.label}
              </ButtonLink>
            ) : (
              <Button
                key={action.label}
                type="button"
                variant={action.tone === "primary" ? "primary" : "ghost"}
                full
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ),
          )}
        </div>
      )}
      {footnote && (
        <div className="nf-caption mt-row text-[var(--nf-content-muted)]">{footnote}</div>
      )}
    </div>
  );
}
