"use client";

import { KeptPriceNote } from "@/components/app/offline/KeptPriceNote";
import { Money } from "@/components/ui/Money";
import { useEffect, useRef } from "react";
import { plural, type Locale } from "@vallo/i18n/core";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { useStayDatesOptional } from "./StayDates";
import { ButtonLink } from "@/components/ui/Button";
import { AuthGate } from "@/components/auth/AuthGate";
import { ActionBar } from "@/components/ui/ActionBar";
import "@/app/css/catalogue.css";

/**
 * The listing's pinned action bar.
 *
 * This was a floating `nf-card` that sat in the document flow with
 * `sticky bottom-…` and `lg:hidden`, which produced two failures the audit
 * calls P0. It read as a card hovering over the page rather than as the
 * blurred footer every reference screen ends with, and from `lg` up it was not
 * rendered at all, so the widest viewport - the one a listing gets shared to on
 * a desktop - had no call to action anywhere on the screen.
 *
 * It is now the `ActionBar` primitive, which the audit found shipped and used
 * zero times. That primitive owns the three things this file kept getting
 * wrong: the blur (so the content reads as passing beneath the bar rather than
 * stopping at a seam), the home-indicator inset, and the stacking level. This
 * file is left with what is genuinely local: what the bar quotes, and which
 * actions the market allows.
 *
 * Reference 3 ends on a PAIR - a hairline ghost pill beside the solid one - and
 * so does this, where a second action honestly exists. A stay pairs Message
 * agent with Check availability; a partner restaurant pairs its menu with
 * directions. A rental has exactly one path (message the agent, inspect, then
 * pay) so it carries one full-strength button and no invented companion.
 *
 * What it quotes is never a guess: once real dates are picked it shows the very
 * total the reserve panel is about to submit, in integer kobo through
 * `formatMoney`, beside the nights it covers. Until then it shows the listing's
 * own rate and what that rate buys.
 */

/**
 * `external` STOOD HERE AND IT IS DELETED.
 *
 * It read "Off-platform destinations open in a new tab" and it spread
 * `target="_blank" rel="noopener noreferrer"` onto both buttons in this bar.
 * NOT ONE CALL SITE EVER SET IT. Its whole purpose was to take a person off
 * Vallo, and the two features that would have reached for it first, a partner
 * handoff and a restaurant's own menu link, are exactly the two the platform
 * has now decided are ingested rather than linked.
 *
 * A prop whose only reason to exist is a rule violation does not sit in the
 * tree waiting for somebody to use it. Anything genuinely off-platform that
 * ever belongs on this bar goes through the consented interstitial, not
 * through a spread on a button.
 */
export type StickyAction = {
  label: string;
  href: string;
};

export function ListingStickyBar({
  variant,
  priceMinor,
  currency,
  locale,
  perLabel,
  action,
  secondary,
  fallbackLabel,
  moveInMinor,
  moveInStated,
  secondaryIcon,
  moveInLabel,
  moveInFromLabel,
  secondaryShortLabel,
  sidePanelFromLg = false,
  stackOnPhone = false,
}: {
  variant: "stay" | "rental" | "partner";
  priceMinor: number;
  currency: string;
  locale: Locale;
  /** What the rate buys, e.g. "per night" or "per year". */
  perLabel: string;
  action: StickyAction | null;
  /**
   * The ghost half of the pair. Rendered only when the market actually has a
   * second thing to do; never a decorative twin of the primary.
   */
  secondary?: StickyAction | null;
  /** Shown instead of a price when the listing carries no real rate. */
  fallbackLabel: string;
  /**
   * The move-in total in kobo, on a tenancy that states one.
   *
   * WHY THE PINNED BAR QUOTES IT RATHER THAN THE RENT. This bar is the last
   * figure a person reads before they act, and on a Nigerian tenancy the rent
   * is not the figure they have to find: `PRODUCT.md` section 5 makes the
   * move-in total the number the product leads with, the card now does, and a
   * bar quoting 4.5m under a page whose own panel says 6.8m is the product
   * disagreeing with itself in the two places a reader compares.
   *
   * Absent on a stay, on a sale, and on the 24 rows in 64 whose lister named
   * neither a total nor a part. In all of those the rate is the honest figure
   * and nothing changes.
   */
  moveInMinor?: number;
  /** False when the total is a floor summed from the parts, so it reads "from". */
  moveInStated?: boolean;
  /** The glyph on the ghost half; the conversation bubble unless told otherwise. */
  secondaryIcon?: "document" | "chat-bubble" | "arrow-right";
  /** "Move-in total", from the caller's dictionary. */
  moveInLabel?: string;
  /** "Move-in from", for a total summed from the named parts. */
  moveInFromLabel?: string;
  /** The ghost half's one-word label on a phone, e.g. "Breakdown". */
  secondaryShortLabel?: string;
  /**
   * The page draws its own sticky side panel from `lg` (the listing page's
   * booking panel), carrying the same action. The bar then stands down from
   * `lg`, so a desktop reader sees one call to action, not the panel's and a
   * pinned twin under it (and the bar no longer runs under the side rail).
   */
  sidePanelFromLg?: boolean;
  /**
   * THE PRIMARY TAKES THE WHOLE WIDTH ON A PHONE (founder's reference, 13
   * October 2026: "Schedule a visit", brand blue, full width). The figure and
   * the quiet second action share the first row and the primary has the
   * second to itself, under 40rem; from 40rem the three sit on one row.
   */
  stackOnPhone?: boolean;
}) {
  // Only a stay has a date picker to read from; the hook is optional so the
  // same bar renders on rental and partner pages with no provider above it.
  const stay = useStayDatesOptional();
  const quoting = variant === "stay" && stay !== null && stay.ready && stay.totalMinor > 0;

  /* A picked set of dates outranks everything: it is the very total the
     reserve panel is about to submit. Otherwise a tenancy quotes what it costs
     to move in and everything else quotes its own rate. */
  const moveIn = variant === "rental" && (moveInMinor ?? 0) > 0 ? moveInMinor! : null;
  const amount = quoting && stay ? stay.totalMinor : (moveIn ?? priceMinor);

  /* The caption once dates are picked. It was built by gluing an English
     ternary onto an English preposition, so a Yoruba reader was quoted a total
     in their own currency format under an English sentence. Both the sentence
     and the night count come from the dictionary now, and the count picks its
     form from `Intl.PluralRules` rather than from an assumption that every
     language has a singular and a plural. */
  const t = useClientCopy();
  const caption =
    quoting && stay
      ? t.reserve.totalForNights.replace("{nights}", plural(stay.nights, t.counts.nights, locale))
      : moveIn
        ? moveInStated === true
          ? (moveInLabel ?? "Move-in total")
          : (moveInFromLabel ?? "Move-in from")
        : perLabel;

  /*
   * THE FOOT'S OWN HEIGHT, PUBLISHED TO THE PAGE.
   *
   * The spacer above cannot be a fixed number: the foot is two rows at 390
   * and one from `sm`, a long property name can add a line to it, and the
   * home-indicator inset differs by device. So the foot measures itself and
   * writes the answer to `--nf-detail-foot-h`, which the spacer reads. The
   * CSS carries a fallback for the first paint and for a browser with no
   * ResizeObserver, so the page is never flush against the bar even before
   * this runs.
   *
   * `offsetHeight` is read from the pinned element rather than from this
   * inner row because the inset and the bar's own padding live on the
   * outer one, and that element belongs to the `ActionBar` primitive.
   */
  const footRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const inner = footRef.current;
    const bar = inner?.closest(".nf-action-bar-pinned");
    if (!(bar instanceof HTMLElement)) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty("--nf-detail-foot-h", `${bar.offsetHeight}px`);
    apply();
    if (typeof ResizeObserver === "undefined") return () => root.style.removeProperty("--nf-detail-foot-h");
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--nf-detail-foot-h");
    };
  }, []);

  return (
    /*
     * `aboveTabBar` is off because `/listing/[id]` is not one of
     * `TAB_BAR_ROUTES`, so there is no floating tab bar on this screen to lift
     * clear of. The bar sits on the edge itself, which is where reference 3
     * puts it.
     */
    <>
      {/*
        THE PAGE HAS TO END ABOVE THE FOOT.

        The foot is `position: fixed`, so it is out of flow and the document's
        last element sits underneath it. Every page that mounts this bar used
        to hand-roll its own `h-[5.5rem]` spacer, which was a guess: the foot
        is two rows tall at 390 and one row from `sm`, and it carries the
        home-indicator inset on top of that, so one hardcoded height was wrong
        on every width it was not measured at. The spacer ships WITH the bar
        now, and it is the bar's own measured height plus the inset the bar
        already absorbs, so the two can never drift apart again.
      */}
      <div aria-hidden="true" className={sidePanelFromLg ? "nf-detail-foot-spacer lg:hidden" : "nf-detail-foot-spacer"} />
      <ActionBar {...(sidePanelFromLg ? { className: "lg:hidden" } : {})}>
      <div
        ref={footRef}
        data-testid="listing-sticky-bar"
        className={stackOnPhone ? "nf-detail-foot nf-detail-foot--stacked" : "nf-detail-foot"}
      >
        <p className="nf-detail-foot__lead">
          {amount > 0 ? (
            <>
              {/* No `truncate` on a price: a clipped figure states a wrong
                  number. The bar's own layout gives this column the room. */}
              <span data-testid="sticky-total" className="nf-detail-foot__figure min-w-0 nf-numeric">
                {/*
                 * THROUGH `formatMoney`, NOT THROUGH `Amount`.
                 *
                 * The bar used `<Amount glance>`, and that is why an earlier
                 * formatter fix did not reach this figure: `Amount` builds its
                 * own `Intl.NumberFormat` with `notation: "compact"` and no
                 * `maximumFractionDigits`, on the belief that Intl's compact
                 * default keeps one fractional digit. It does not. Compact
                 * notation defaults to TWO SIGNIFICANT DIGITS, so ₦14,700,000
                 * came out ₦15m: three hundred thousand naira more than the
                 * obligation, on the bar directly under a card reading
                 * ₦14,700,000.
                 *
                 * `formatMoneyGlance` is the same one-million-naira threshold
                 * applied by `formatMoney`, which keeps the tenth. It is also the rule: money is displayed only
                 * through `formatMoney`. `Amount` is not in this scope and the
                 * defect is reported rather than edited here.
                 */}
                <Money minor={amount} locale={locale} currency={currency} mode="glance" />
              </span>
              {/* No `truncate`. A caption that reads "to move in, from the p..."
                  is a promise trimmed into a different promise, and this column
                  has the room to wrap. */}
              <span className="nf-detail-foot__caption whitespace-nowrap leading-snug">{caption}</span>
              {/* Read off the phone's kept copy, the figure says so (SW15). */}
              <KeptPriceNote inline />
            </>
          ) : (
            /* The property's name, on the bar a person acts from, and it was
               clipped. This is the branch where the listing carries no real
               rate, so the title is the ONLY thing the bar says about what the
               button is for: "Five bedroom villa for sale in Oniru Vict..." is
               the one sentence on the screen, cut. It wraps, and the bar grows
               by a line on the few rows that need it. */
            <span className="text-[length:var(--nf-text-body-sm)] font-semibold leading-snug text-[var(--nf-content-primary)] [overflow-wrap:anywhere]">
              {fallbackLabel}
            </span>
          )}
        </p>

        {/*
          The ghost half. On a 390px screen the pair plus a price does not fit
          three labels wide, so the ghost keeps its glyph and drops its label
          until there is room for it - the label stays in the accessible name
          throughout, so the control is never unlabelled to a screen reader.
        */}
        {/*
          BOTH HALVES GATE, and they gate to different verbs.

          A guest reaching this bar is allowed to be here - the property page is
          open to anybody - so these controls are drawn at full strength rather
          than hidden or disabled. What they do differs: with a session they go
          where they say, and without one they open sign-up carrying this
          listing's URL and the verb, so signing in lands the person back on
          this property with the same button under their thumb.

          The verbs are inferred from the market rather than passed in, because
          they are already determined by it: the ghost half is always the
          conversation, and the solid half is the inspection on a rental and the
          payment on a stay. A fourth combination would mean a new market, and a
          new market has to be described here anyway.
        */}
        {secondary && secondaryIcon === "document" ? (
          /* The move-in ledger is a page anybody may read, so it does not
             gate. A phone gets the short word and the glyph; the full label
             returns from `sm`, and is the accessible name throughout. */
          <ButtonLink
            href={secondary.href}
            variant="secondary"
            size="sm"
            leadingIcon="document"
            aria-label={secondary.label}
            className="nf-detail-foot__secondary"
            data-testid="sticky-breakdown"
          >
            {/* Under 23rem (a 320 phone, two rows) the short word; from 23rem
                to `sm` the glyph alone on the one-row bar; the full label
                from `sm`. The accessible name is the full label throughout. */}
            <span className="nf-btn__label min-[23rem]:hidden">{secondaryShortLabel ?? secondary.label}</span>
            <span className="nf-btn__label hidden sm:inline">{secondary.label}</span>
          </ButtonLink>
        ) : secondary ? (
          <AuthGate action="message">
            <ButtonLink
              href={secondary.href}
              variant="ghost"
              leadingIcon={secondaryIcon ?? (variant === "partner" ? "arrow-right" : "chat-bubble")}
              aria-label={secondary.label}
              className="nf-detail-foot__secondary"
            >
              <span className="nf-btn__label hidden sm:inline">{secondary.label}</span>
            </ButtonLink>
          </AuthGate>
        ) : null}

        {action && (
          <AuthGate action={variant === "rental" ? "inspect" : "pay"}>
            <ButtonLink
              href={action.href}
              variant="primary"
              size="md"
              leadingIcon={variant === "rental" ? "calendar-booking" : undefined}
              className="nf-detail-foot__action"
              data-testid="sticky-action"
            >
              {action.label}
            </ButtonLink>
          </AuthGate>
        )}
      </div>
      </ActionBar>
    </>
  );
}
