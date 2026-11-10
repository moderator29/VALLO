import { OPEN_MARK_SVG } from "./open-mark.generated";

/**
 * THE OPENING SCREEN'S MARKUP (10 November 2026): the brand mark as inline SVG,
 * so it is in the first HTML and needs no request, first in the body so it is
 * the first thing painted. `open.css` shows it only in an installed app and
 * `open-script.ts` lifts it. Decorative: the page under it says what it is.
 */
export function OpeningScreen() {
  return (
    <div id="nf-open" className="nf-open" aria-hidden="true" data-nosnippet="">
      <div className="nf-open__mark" dangerouslySetInnerHTML={{ __html: OPEN_MARK_SVG }} />
    </div>
  );
}
