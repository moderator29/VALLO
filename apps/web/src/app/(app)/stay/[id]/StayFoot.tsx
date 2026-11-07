"use client";

import { KeptPriceNote } from "@/components/app/offline/KeptPriceNote";
import { useEffect, useRef } from "react";
import type { Locale } from "@vallo/i18n/core";
import { Money } from "@/components/ui/Money";
import { ButtonLink } from "@/components/ui/Button";
import { AuthGate } from "@/components/auth/AuthGate";
import { ActionBar } from "@/components/ui/ActionBar";
import "@/app/css/catalogue.css";
import "./stay-detail.css";

/**
 * THE STAY'S ONE ANCHORED ACTION (`PREMIUM-STANDARD.md`: one detail anatomy
 * and one anchored primary action, the same as the Property side).
 *
 * The property detail ends on `ListingStickyBar`; a stay now ends on the same
 * foot, in the same classes (`nf-detail-foot`), so the two markets read as one
 * product: the figure on the left with what it buys under it, and the single
 * lit control on the right. It is the ONLY primary on the page; the dates card
 * above it submits its form as a secondary, and the rooms list keeps its own
 * per-room reserve links.
 *
 * WHAT IT SAYS, in the order the page knows it:
 *   dates picked and a rate can be booked  the total of the rate Book now
 *     opens, "for N nights", and Book now, gated to pay exactly as the
 *     availability card's Book now was;
 *   dates picked, nothing bookable          the nightly figure and See rooms;
 *   no dates                                the nightly figure and Pick your
 *     dates, which scrolls to the form and gates nothing.
 * The figure is always one the page already states above; the foot never
 * computes a number of its own.
 *
 * Why not `ListingStickyBar` itself: it gates its solid half to `pay` on every
 * stay, which would ask a signed-out guest to sign in before choosing dates.
 * The spacer and the measured height are the same mechanism it uses.
 */
export function StayFoot({
  figureMinor,
  caption,
  locale,
  action,
}: {
  figureMinor: number | null;
  caption: string;
  locale: Locale;
  action: { label: string; href: string; gate: "pay" | null };
}) {
  const footRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = footRef.current?.closest(".nf-action-bar-pinned");
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

  const button = (
    <ButtonLink href={action.href} variant="primary" size="md" className="nf-detail-foot__action" data-testid="stay-foot-action">
      {action.label}
    </ButtonLink>
  );

  return (
    <>
      <div aria-hidden="true" className="nf-detail-foot-spacer" />
      <ActionBar glow>
        <div ref={footRef} data-testid="stay-foot" className="nf-detail-foot nf-stay-foot">
          <p className="nf-detail-foot__lead">
            {figureMinor !== null && figureMinor > 0 ? (
              <>
                <span className="nf-detail-foot__figure min-w-0 nf-numeric" data-testid="stay-foot-figure">
                  <Money minor={figureMinor} locale={locale} mode="full" />
                </span>
                <span className="nf-detail-foot__caption whitespace-nowrap leading-snug">{caption}</span>
                {/* Read off the phone's kept copy, the figure says so (SW15). */}
                <KeptPriceNote inline />
              </>
            ) : (
              <span className="nf-detail-foot__caption leading-snug">{caption}</span>
            )}
          </p>
          {action.gate ? <AuthGate action={action.gate}>{button}</AuthGate> : button}
        </div>
      </ActionBar>
    </>
  );
}
