import { OPEN_LAUNCH_SVG } from "./open-launch.generated";

/**
 * THE OPENING SCREEN'S MARKUP (10 November 2026, animated 11 November 2026).
 *
 * The brand mark AND the wordmark as inline SVG, so they are in the first HTML
 * and need no request: the opening is the first thing painted. `open.css` draws
 * the sequence (the ring sweeping round, the four towers rising, the mark
 * travelling to its place, the five letters sliding out from behind it) and
 * `open-script.ts` lifts the whole layer once the page is ready.
 *
 * IT WAS A STILL MARK UNTIL NOW, AND THAT WAS NOT WHAT WAS ASKED FOR (the
 * founder, 11 November 2026: "it was built and I was the one who said it should
 * be built"). The choreography had been drawn into `public/brand/launch/vallo-launch.svg`
 * and was never wired to the opening, which showed a motionless mark that scaled
 * in and drifted. The artwork is the same file, inlined by
 * `scripts/build-brand-launch.mjs` with its own style element stripped, because
 * the policy allows none in the document; the rules it carried are in
 * `open.css` now, under `.nf-open__launch`.
 *
 * Decorative: the page under it says what it is.
 */
export function OpeningScreen() {
  return (
    <div id="nf-open" className="nf-open" aria-hidden="true" data-nosnippet="">
      <div className="nf-open__launch" dangerouslySetInnerHTML={{ __html: OPEN_LAUNCH_SVG }} />
    </div>
  );
}
