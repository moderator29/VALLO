import type { ReactNode } from "react";
import { BrandIcon, type BrandIconProp } from "@/design-system/icons/BrandIcon";
import { glyphSrc, type GlyphName } from "@/design-system/icons/glyphs";

/** The founder's glyph for each object these empties name; anything else keeps its render. */
const DEMPTY_GLYPH: Partial<Record<string, GlyphName>> = {
  "search-pin": "empty-search",
  "apartment-block": "apartment",
  "cup-saucer": "empty-tables",
  "doc-search": "listing-in-review",
  "house-heart": "empty-saved",
  suitcase: "hotel",
};
import { ButtonLink } from "@/components/ui/Button";
import "./discovery.css";

/**
 * THE DISCOVERY EMPTY STATE (Session 3, W2; north star 10 B, motion 21).
 *
 * Every discovery surface is empty until supply arrives, so this is not an
 * edge case: on the day it shipped it was what home, search, stays,
 * restaurants and the shortlist actually showed. It is therefore built as a
 * screen in its own right rather than a fallback, with three parts and an
 * order that does not change:
 *
 *   1. THE OBJECT, settling in. A tiered asset (D29: a real place when the
 *      shelf is about places, a matte symbol when it is about an idea), drawn
 *      on a radius-14 ground in light so it never floats on white (14.7). It
 *      drops 12px onto the ground and settles on `drift` at 520ms (motion 21),
 *      which says "this is where things will arrive" rather than decorating.
 *   2. THE HONEST REASON, which fades in only after the object has landed, so
 *      the eye reads the object first and the sentence second. One title, one
 *      sentence, true of the state the reader is in.
 *   3. A WAY TO CAPTURE THE DEMAND. An empty shelf is still a person who wants
 *      something, and the platform has a real place to put that want (a brief
 *      listers answer with a listing, a saved search that tells you the minute
 *      a match goes live). `capture` is that slot, drawn under the action as a
 *      quiet line, never a second primary.
 *
 * Server-safe: no hooks and no client boundary. The motion is a stylesheet
 * entrance on the tokens, so reduced motion, Calm and Off collapse it the way
 * they collapse every other entrance (`motion-pref.css`), and nothing here
 * waits on a script to be readable.
 */
export function DiscoveryEmpty({
  object,
  title,
  body,
  primary,
  secondary,
  capture,
  className,
  "data-testid": testId,
}: {
  /** A tiered object name (`object-assets.ts`) or a glass name it maps from. */
  object: BrandIconProp;
  title: string;
  /** One sentence: why it is empty, true of the state the reader is in. */
  body: string;
  /** The single next thing to do. Omit where there honestly is not one. */
  primary?: { href: string; label: string; testId?: string; prefetch?: boolean };
  /** A quiet second way onward, a link rather than a competing button. */
  secondary?: ReactNode;
  /** The demand capture: a brief, a saved search, a note of what was asked. */
  capture?: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <section
      className={["nf-dempty", className ?? ""].filter(Boolean).join(" ")}
      data-state-kind="empty"
      data-testid={testId}
    >
      <span className="nf-dempty__ground" aria-hidden="true">
        <span className="nf-dempty__object">
          {DEMPTY_GLYPH[String(object)] ? (
            // eslint-disable-next-line @next/next/no-img-element -- a transparent glyph at 96px
            <img src={glyphSrc(DEMPTY_GLYPH[String(object)]!)} alt="" width={96} height={96} decoding="async" className="size-24 object-contain" />
          ) : (
            <BrandIcon name={object} size={96} />
          )}
        </span>
      </span>
      <div className="nf-dempty__words">
        <h2 className="nf-dempty__title">{title}</h2>
        <p className="nf-dempty__body">{body}</p>
      </div>
      {primary || secondary ? (
        <div className="nf-dempty__actions">
          {primary ? (
            <ButtonLink
              href={primary.href}
              variant="primary"
              full
              {...(primary.prefetch ? { prefetch: true } : {})}
              {...(primary.testId ? { "data-testid": primary.testId } : {})}
            >
              {primary.label}
            </ButtonLink>
          ) : null}
          {secondary ? <div className="nf-dempty__secondary">{secondary}</div> : null}
        </div>
      ) : null}
      {capture ? <div className="nf-dempty__capture">{capture}</div> : null}
    </section>
  );
}
