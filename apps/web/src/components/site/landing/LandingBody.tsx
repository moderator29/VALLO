import "@/app/css/landing-3d.css";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { getListingRepository } from "@/lib/listings/repository";
import { landingCatalogue } from "@/lib/listings/landing-catalogue";
import type { Listing, ListingKind } from "@/lib/listings/types";
import { isSocialEnabled } from "@/lib/social/flag";
import { getPlatformStats, type PlatformStats } from "@/lib/platform-stats";
import type { MiniListing } from "@/lib/site/listing-card";
import "@/app/css/landing-plasma.css";
import { Hero } from "./Hero";
import { Markets } from "./Markets";
import { DealStory } from "./DealStory";
import { TrustLayer } from "./TrustLayer";
import { LandingFaq } from "./LandingFaq";
import { FinalCta } from "./FinalCta";
import { landingDoor } from "./doors";

/**
 * Everything the landing prints that comes from the platform, read once.
 *
 * `stats` is `platform_stats()`; `counts` is the per-kind tally off one
 * catalogue page, kept ONLY when that page provably held the whole
 * catalogue. The read is capped, so the check is the platform's own total:
 * when the tally adds up to `stats.listings` the page was complete and the
 * category tiles may print numbers; otherwise they print none.
 *
 * The AI room's `showcase` (real listings its example conversation could put
 * under a reply) left with the room itself (the founder, 7 October 2026).
 */
export type LandingData = {
  /** Unused by the landing; the preview fixtures still pass it. */
  cards?: MiniListing[];
  stats: PlatformStats | null;
  counts: ReadonlyMap<ListingKind, number> | null;
  /** Whether Around is switched on (the `social` flag, which fails open). The
      ecosystem layer drops its Around door when it is off, as the app does. */
  social?: boolean;
  /** Whether a stranger may open the catalogue (`VALLO_PUBLIC_CATALOGUE`).
      Left out, it is read from the environment; the preview harness may
      pass either answer to prove both sets of doors. */
  open?: boolean;
};

export async function landingData(): Promise<LandingData> {
  /* OPS-11: the shared five-minute read when there is a database; the
     repository (empty or API-backed) otherwise. Only the catalogue is
     needed, for the per-kind counts. */
  const [shared, stats, social] = await Promise.all([landingCatalogue(), getPlatformStats(), isSocialEnabled()]);
  const catalogue: Listing[] = shared ? shared.catalogue : await getListingRepository().search();
  const tally = new Map<ListingKind, number>();
  for (const l of catalogue) tally.set(l.kind, (tally.get(l.kind) ?? 0) + 1);
  const complete = stats !== null && catalogue.length > 0 && catalogue.length === stats.listings;
  return {
    stats,
    counts: complete ? tally : null,
    social,
  };
}

/**
 * The landing's sections in the fullpage render's order, on data the caller
 * supplies. `app/(landing)/page.tsx` passes the live read; `app/(dev)/preview/f2`
 * passes fixtures so the look can be proven in a sandbox that cannot reach
 * the catalogue. Both render this same tree.
 */
export function LandingBody({
  t,
  locale,
  data,
  native = false,
  nonce,
}: {
  t: Dictionary;
  locale: Locale;
  data: LandingData;
  /** The CSP nonce, for the FAQ's structured data block. */
  nonce?: string;
  /** Rendering for a native shell: the "take Vallo with you" band, with its
      store badges and its "installs from your browser" line, is left out
      (STORE-06, App Store 2.3.10). */
  native?: boolean;
}) {
  const door = landingDoor(data.open);
  return (
    <main id="main">
      {/*
        HOW THE PAGE GOT HERE, oldest first. The founder's render of 19
        September set the first order; Track M (25 September) added rooms;
        the launch pass and the clean pass (29 September) cut the repeats;
        the unified pass (29 September, evening) made ten rooms with one job
        each.

        THE SESSION 3 PASS (6 October; the handoff's Stage 3 and north star
        10 A) is the current order, eight rooms, the brand's story told in
        the order a person meets it:

          Hero        the governing composition: night, the villa, the slogan,
                      the explanation, two doors, the example card, the
                      search capsule, three facts
          Move-in     the argument the platform was built on, as its own band:
                      the example flat's whole cost, counted up and itemised
          Platform    the operating system for physical spaces, six layers
                      (trust, discover, intelligence, transactions, operations,
                      ecosystem), one at a time, each with a moment drawn from
                      the product's own components and a Vallo passport
          Journey     find, inspect, agree, move in
          Categories  eight kinds of place, then the cities on the drawn map
          Community   who it is for, real figures only, the Third party label,
                      and "Check before you pay" with the check in the card
          App, FAQ    on your phone; the short answers in one grouped card
          Close       the final card: sign up, or sign in

        THE 3D PASS (7 October; the founder: "my landing page is even still
        the same, no upgrade... do animations"). Two rooms that carried his
        3D objects come back, ten rooms in all:

          Bento       "Everything the move needs": seven doors, each with one
                      of the founder's 3D objects, straight after the hero
                      so the art is the first thing under the fold
          AI          the assistant's three rules, each with its object,
                      beside the example conversation that types itself

        The hands-on deck and the Property and Stays switch stay folded into
        the platform band: they carried no 3D art. Every room rises in as it
        enters the viewport (MotionReveal; landing-3d.css, "the 3D pass").

        THE PLASMA PASS (P7, 7 October evening; PREMIUM-STANDARD.md, the
        governing level, and the founder: "more vibes lovely stuffs...
        clean... next gen"). Ten rooms told the same story three times
        (bento, platform band, journey) and buried it. Seven now, each with
        one job, on a near-black field with the content lit
        (landing-plasma.css):

          Hero        the slogan, the explanation, the trust promise per
                      rail, one white capsule, the example card, the search
          Markets     homes, stays, restaurants, workspaces: a rolling card
                      stack that rolls as you scroll or tap
          Story       find, verify, agree, pay, move in: five cards stacking
                      on scroll, a product fragment breaking out of a phone
                      on each, the founder's 3D object for each step
          Trust       the Vallo passport as the page's one platinum object,
                      the agent check that works in place, and where the
                      money goes in the founder's own sentence
          AI          the assistant room, kept: it is a 3D room that earns
                      its place, the one feature the story does not tell
          FAQ         the short answers
          Close       "Find. Agree. Move in.", the capsule, and the app

        The move-in band, the platform band, the journey, the categories
        and map, the community band and the app band are retired from the
        page: the markets carry the kinds of place, the story carries the
        move-in total and the steps, and the trust layer carries the check.
        Their components and their rules were removed on 17 October.

        THE FOUNDER'S CUT (7 October, late, on a phone). Six rooms now:

          Hero        the slogan and the explanation; the markets breadcrumb
                      and the money promise line left it (the money story
                      is told in the docs, "How money moves on Vallo")
          Markets, Story, Trust, FAQ   unchanged
          Close       only "On your phone" and the store badges: sign in and
                      sign up live in the top capsule, so the closing
                      "Find. Agree. Move in." call to action left

        The AI room (the example conversation that typed itself, "Play
        again") left the page; the assistant stays one tap away in the
        capsule's menu. AiBand.tsx and AiShowcase.tsx went with the other
        retired rooms on 17 October.
      */}
      <Hero t={t} locale={locale} door={door} />
      <Markets t={t} door={door} />
      <DealStory t={t} locale={locale} />
      <TrustLayer t={t} locale={locale} />
      <LandingFaq t={t} nonce={nonce} />
      <FinalCta t={t} native={native} />
    </main>
  );
}
