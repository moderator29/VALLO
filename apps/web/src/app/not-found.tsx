import type { Metadata } from "next";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { resolveSession } from "@/lib/actions/session";
import { getDictionary } from "@vallo/i18n";
import { SystemMoment } from "./offline/SystemMoment";

const LOST = getDictionary("en").trustVisible.state;
/* The property search field says the same thing here as it does on the
   results screen it submits to. This page had a third wording of its own
   ("Search homes, shortlets, land") while `/search` said "Search or describe
   your home" and the signed-in home said something else again, so one field,
   one destination and three invitations. */
const SEARCH = getDictionary("en").searchV2;

/**
 * 404: the brand moment with a way to search.
 *
 * Same anatomy as the error boundary and the offline screen (the lockup over
 * the aurora plate, the glass card on its podium), with the numeral in the
 * brand gradient, a sentence that says what happened, and a search field
 * that really searches: it is a plain GET form to `/search`, whose page
 * reads `q` and answers it, so the way out of a dead link is the product's
 * own front door rather than a decorative box.
 *
 * "Back to home" means the home the reader actually has. It pointed at `/`,
 * the landing page, which for a signed-in person is not home at all. This
 * renders on the server, so it can simply ask, and a signed-in reader is
 * offered `/home` instead. The cost is one session read on a page nobody is
 * meant to reach often, and the screen still renders in full if that read
 * comes back with nothing.
 */
/* OPS-17: the not-found page is never a page to index. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NotFound() {
  const session = await resolveSession();
  const home = session.state === "signed-in" ? "/home" : "/";
  return (
    <SystemMoment home={home}>
      {/*
       * A MARKER FOR THE SCREENSHOT HARNESS, AND IT IS HERE BECAUSE THE
       * OBVIOUS CHECK DOES NOT WORK.
       *
       * `notFound()` called from a layout during streaming answers HTTP 200
       * with this body; this was confirmed independently three times while
       * the preview harness was shut. So `verify-shots.mjs` checking the
       * status code is necessary and NOT sufficient: it cannot tell this page
       * from a surface, and neither can any of its other assertions. This page
       * loads the same stylesheet and has no Reveal bands to get stuck, so it
       * passes every one of them perfectly. (It also used to set `data-theme`
       * from the same inline script as every other route; that script went with
       * light mode on 23 September 2026 and nothing about this trap changed.) Workers wrote eight PNGs of this screen and
       * nearly filed them as proof that a surface had been swept.
       *
       * One attribute settles it, and it is on the page itself rather than
       * guessed at from a class name, because a class can be renamed by
       * somebody with no idea a harness depends on it.
       */}
      <span data-nf-not-found="1" hidden />
      <p className="nf-system__code" aria-hidden="true">
        404
      </p>
      {/* V-97: the words follow the voice rules. The old title was a hotel
          pun on a screen every side of the market reaches, and the old body
          promised every place was where it should be, which no code checks. */}
      <h1 className="nf-system__title">{LOST.lostTitle}</h1>
      <p className="nf-system__body">{LOST.lostBody}</p>

      <form action="/search" method="get" role="search">
        <label htmlFor="nf-lost-search" className="sr-only">
          Search property
        </label>
        <div className="nf-system__search">
          <span className="nf-system__search-glyph" aria-hidden="true">
            <UiIcon name="search" size={20} />
          </span>
          <input
            id="nf-lost-search"
            name="q"
            type="search"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={SEARCH.placeholder}
            className="nf-field"
          />
        </div>
        <div className="nf-system__actions">
          <Button type="submit" variant="primary" size="lg" full trailingIcon="arrow-right">
            Search
          </Button>
          <ButtonLink href={home} variant="secondary" size="lg" full>
            Back to home
          </ButtonLink>
        </div>
      </form>
    </SystemMoment>
  );
}
