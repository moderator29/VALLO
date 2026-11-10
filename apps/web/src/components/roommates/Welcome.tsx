import type { CSSProperties } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";

import { counted, type RoommatesCopy } from "./format";
import { SkylineArt } from "./RoommatesArt";
import "./roommates-welcome.css";

/**
 * THE ROOMMATES WELCOME BANNER (server safe). A night island in both themes:
 * the tagline set large in three offset lines, the supporting line, four
 * stacked check pills that say what the product does, two buttons (Create
 * listing, Explore) and the REAL counts from the database, drawn over Vallo's
 * own skyline art. A count that is zero or unreadable is not drawn: a number
 * is never invented.
 */
export function RoommatesWelcome({
  t: copy,
  createHref,
  exploreHref,
  counts,
  greeting,
}: {
  t: RoommatesCopy;
  createHref: string;
  exploreHref: string;
  /** Live counts from the home read; null or zero hides that figure. */
  counts: { people: number | null; rooms: number | null } | null;
  greeting?: string | null;
}) {
  const lines = copy.tagline.split(". ").map((s, i, all) => (i < all.length - 1 ? `${s}.` : s));
  const w = copy.welcome;
  const figures: string[] = [];
  if (counts?.people && counts.people > 0) figures.push(counted(counts.people, w.people));
  if (counts?.rooms && counts.rooms > 0) figures.push(counted(counts.rooms, w.rooms));
  return (
    <section className="nf-rmw" data-theme="dark" aria-labelledby="rmw-title" data-testid="roommates-hero">
      <div className="nf-rmw__art" aria-hidden="true">
        <SkylineArt />
      </div>
      <div className="nf-rmw__words">
        <p className="nf-rmw__eyebrow" style={{ "--nf-rmw-i": 0 } as CSSProperties}>
          <span className="nf-rmw__mark" aria-hidden="true">
            <UiIcon name="home" size={14} />
          </span>
          {greeting ?? w.eyebrow}
        </p>
        <h2 id="rmw-title" className="nf-rmw__title">
          {lines.map((l, i) => (
            <span key={l} className="nf-rmw__line" data-n={i} style={{ "--nf-rmw-i": i + 1 } as CSSProperties}>
              {l}
            </span>
          ))}
        </h2>
        <p className="nf-rmw__sub" style={{ "--nf-rmw-i": 4 } as CSSProperties}>
          {w.line}
        </p>
        <ul className="nf-rmw__pills" data-testid="roommates-hero-checks">
          {w.checks.map((c, i) => (
            <li key={c} className="nf-rmw__pill" style={{ "--nf-rmw-i": i + 5 } as CSSProperties}>
              <span className="nf-rmw__tick" aria-hidden="true">
                <UiIcon name="check" size={12} />
              </span>
              {c}
            </li>
          ))}
        </ul>
        <div className="nf-rmw__actions" style={{ "--nf-rmw-i": 9 } as CSSProperties}>
          <ButtonLink href={createHref} variant="primary" size="lg" leadingIcon="plus" glow data-testid="roommates-post">
            {w.create}
          </ButtonLink>
          <ButtonLink href={exploreHref} variant="secondary" size="lg" leadingIcon="search" data-testid="roommates-find">
            {w.explore}
          </ButtonLink>
        </div>
        {figures.length ? (
          <p className="nf-rmw__figures" style={{ "--nf-rmw-i": 10 } as CSSProperties} data-testid="roommates-hero-people">
            {figures.map((f) => (
              <span key={f} className="nf-rmw__figure">
                {f}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  );
}
