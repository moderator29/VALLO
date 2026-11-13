import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON } from "@/components/app/Screen";
import { SwipeStack } from "@/components/app/listing/SwipeStack";
import { StayStackCard } from "./StayStackCard";
import { StayCard } from "./StayCard";
import { forStayCard } from "@/lib/i18n/slice";
import type { StayCardData } from "./stay-card-model";
import "@/app/css/home.css";

/**
 * FEATURED STAYS AS A STACK (the travel-app reference, 7 October 2026): the
 * Stays home's shelf, a swipeable stack of up to six places rather than a
 * scroll row, with the same heading and "See all" the band carried. The empty
 * shelf is the caller's honest empty state, unchanged.
 *
 * One component for the route and its preview harness, so the harness can no
 * longer drift from the page it proves.
 */
export function StaysFeatured({
  stays,
  title,
  seeAllHref,
  locale,
  t,
  isSaved,
  canSavePlaces,
  empty,
  testId = "featured-stays",
}: {
  stays: readonly StayCardData[];
  title: string;
  seeAllHref: string;
  locale: Locale;
  t: Dictionary;
  isSaved: (stay: StayCardData) => boolean;
  canSavePlaces: boolean;
  empty: ReactNode;
  testId?: string;
}) {
  const shown = stays.slice(0, 6);
  const copy = t.catalogue.stays;
  /* The client cards get the stay card slice, not the whole dictionary. */
  const cardT = forStayCard(t);
  return (
    <section className="mt-section-tight" data-testid={testId}>
      <div className="nf-feature-head">
        <h2 className="nf-h3">{title}</h2>
        {shown.length > 0 ? (
          <Link href={seeAllHref} className="nf-section-action nf-link-quiet nf-tap nf-body-sm shrink-0">
            {copy.seeAll}
            <UiIcon name="arrow-right" size={ICON.inline} />
          </Link>
        ) : null}
      </div>
      {shown.length === 0 ? (
        empty
      ) : (
        <div className="mt-row">
          {/* A phone swipes a stack; from 640px the same six places are a grid
              of cards, because one card in a wide empty row was the founder's
              "half-empty phone page" (27 October 2026). CSS shows one of the
              two (`.nf-feature-stack`, `.nf-feature-grid` in home.css). */}
          <div className="nf-feature-stack">
            <SwipeStack label={title} copy={copy.stack}>
              {shown.map((stay, index) => (
                <StayStackCard
                  key={stay.id}
                  stay={stay}
                  locale={locale}
                  t={cardT}
                  index={index}
                  eager={index === 0}
                  saved={isSaved(stay)}
                  canSavePlaces={canSavePlaces}
                />
              ))}
            </SwipeStack>
          </div>
          <ul className="nf-feature-grid" data-testid={`${testId}-grid`}>
            {shown.map((stay, index) => (
              <li key={stay.id} className="min-w-0">
                <StayCard
                  stay={stay}
                  locale={locale}
                  t={cardT}
                  index={index}
                  saved={isSaved(stay)}
                  canSavePlaces={canSavePlaces}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
