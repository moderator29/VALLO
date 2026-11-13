import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON } from "@/components/app/Screen";
import "@/app/css/home.css";

/**
 * The featured band, to `GOVERNING-01` screen one and `GOVERNING-09` screen
 * one: a heading with a quiet "See all" on its right, and beneath it a row of
 * cards that scrolls SIDEWAYS rather than a grid that stacks.
 *
 * THE ROW SCROLLS AND THE CARDS DO NOT SHRINK. Both renders draw the second
 * card cut off at the right edge, which is the affordance: it says there are
 * more without spending a control on saying so. That is one CSS decision (a
 * fixed card width plus horizontal scroll with snap) and it is in
 * `.nf-feature-row`, not here.
 *
 * IT TAKES CHILDREN RATHER THAN ROWS. The property side hands it
 * `ListingCard`s and the Stays side hands it `StayCard`s, and both of those
 * are shared cards owned elsewhere that must never be forked to appear here.
 * This component owns the BAND: the heading, the link, the scroller and the
 * empty state. It owns no card.
 *
 * NOTHING IS PRINTED WHEN THE DATABASE RETURNS NOTHING. The roles README's
 * seventh translation rule: every count and price in the renders is example
 * content. An empty shelf renders the caller's own empty state, never a
 * placeholder card.
 */
export function FeaturedBand({
  title,
  seeAllHref,
  seeAllLabel,
  children,
  empty,
  count,
  testId,
  note,
  body,
}: {
  title: string;
  seeAllHref: string;
  seeAllLabel: string;
  /** One `<li>` per card. Empty renders `empty` instead of the scroller. */
  children: ReactNode;
  empty: ReactNode;
  /** How many cards `children` holds, so the band can tell empty from full. */
  count: number;
  testId: string;
  /** One quiet line under the title saying why the order is what it is, only when it is (Session 3, W2). */
  note?: string;
  /**
   * A body other than the sideways row: home's card stack (FeaturedStack).
   * Without it the band draws its row of `children`, as it always did.
   */
  body?: ReactNode;
}) {
  return (
    <section className="mt-section-tight">
      <div className="nf-feature-head">
        <h2 className="nf-h3">{title}</h2>
        {count > 0 && (
          <Link
            href={seeAllHref}
            className="nf-section-action nf-link-quiet nf-tap nf-body-sm shrink-0"
          >
            {seeAllLabel}
            <UiIcon name="arrow-right" size={ICON.inline} />
          </Link>
        )}
      </div>
      {note && count > 0 ? (
        <p className="nf-caption mt-inline-tight text-[var(--nf-content-muted)]" data-testid="featured-note">
          {note}
        </p>
      ) : null}
      {count === 0 ? (
        empty
      ) : body ? (
        body
      ) : (
        <ul className="nf-feature-row nf-scroll-x nf-scroll-x--gutter" data-testid={testId}>
          {children}
        </ul>
      )}
    </section>
  );
}
