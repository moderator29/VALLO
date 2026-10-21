import type { Metadata } from "next";
import { Suspense } from "react";
import { isPropertyMarket, marketOf } from "@/lib/listings/market";
import { redirect } from "next/navigation";
import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getHomeOverview } from "@/lib/app/home-queries";
import { getListingRepository } from "@/lib/listings/repository";
import { HomeScreen } from "@/components/app/home/HomeScreen";
import { UpNext } from "@/components/app/home/UpNext";
import { getAgentContext } from "@/lib/agent/listings-queries";
import { getMode } from "@/lib/mode";
import { roleStateFrom, type AgentFacts } from "@/components/roles/roles";
import { readIntentTuning, type IntentTuning } from "@/lib/interests/queries";
import { orderByStatedIntent } from "@/lib/listings/intent";
import { rankRecommended } from "@/lib/listings/ranking";
import { getSavedListings } from "@/lib/saved/queries";
import type { Listing } from "@/lib/listings/types";
import type { HomeLeadFigure } from "@/components/app/home/HomeFigure";
import { PROPERTY_SPACE_TYPES, type SpaceTypeKey } from "@/components/app/home/space-types";
import { BestMatchesStream, NewListingsStream } from "@/components/app/home/HomeStreams";
import { HomeListSkeleton } from "@/components/app/home/HomeLists";

/** How many places Premium draws, and how many more Featured listings adds under it. */
const PREMIUM_SHOWN = 6;
const FEATURED_MORE = 6;

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

/**
 * Home: the overview.
 *
 * The first screen anybody sees, and the one place where every fact has to be
 * the reader's own. The greeting is decided by the clock in Lagos, not by the
 * server's timezone. The name is theirs. The city is theirs, read from their
 * profile, and the chip beside it goes to the screen that changes it. The
 * cards are the catalogue's real rows and the places are `public.areas`.
 *
 * This file owns the reads and the gate; `HomeScreen` owns the screen, so the
 * preview harness can render the same screen from fixtures.
 *
 * Rendered per request rather than cached, because a page that says "Good
 * morning" cannot be served from a build that ran last night.
 */
export const dynamic = "force-dynamic";

/**
 * What this person said they came for, and the rows that answer it.
 *
 * Started in the page's first wave and chained on `readIntentTuning()`, so the
 * (at most three) kind reads run in parallel with each other and with the
 * overview, the recommended shelf and the rest, instead of as a second wave
 * after all of them. Each read keeps the catalogue's own ceiling: the search
 * orders by publication date before it caps, so a smaller limit would hand
 * `rankRecommended` only the newest rows and change what ranking sees, which
 * is Session 2's to decide (a ranked SQL read is request W2-R2).
 */
async function readStatedKinds(
  repo: ReturnType<typeof getListingRepository>,
): Promise<{ tuning: IntentTuning; stated: SpaceTypeKey[]; forThem: Listing[] }> {
  const tuning = await readIntentTuning();
  const stated = tuning.interests
    .filter((kind): kind is SpaceTypeKey => (PROPERTY_SPACE_TYPES as readonly string[]).includes(kind))
    .slice(0, 3);
  if (stated.length === 0) return { tuning, stated, forThem: [] };
  const rows = await Promise.all(stated.map((kind) => repo.search({ kind, propertySide: true })));
  return { tuning, stated, forThem: rows.flat() };
}

export default async function HomePage() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const repo = getListingRepository();
  /*
   * Every read on this page is independent of the others and free of side
   * effects, so they go out together rather than one after another: each is a
   * separate round trip to the database, and in sequence they were the longest
   * wait before Home's first byte. The first-run redirect below still runs
   * before anything is drawn; the reads it makes unnecessary only read, so
   * starting them early changes when they finish and nothing else.
   */
  const [overview, recommended, agentContext, mode, intent, savedEntries] = await Promise.all([
    getHomeOverview(),
    repo.recommended(18),
    getAgentContext(),
    getMode(),
    /* Session 3, W2: what this person said they came for, the same read
       `/search` orders its unfiltered shelf by. Empty for a guest. The
       catalogue reads for each stated kind hang off it in the same wave
       (see `readStatedKinds` below), so they overlap everything else
       instead of waiting behind it. */
    readStatedKinds(repo),
    /* The account's shortlist, for the figure home leads with. Empty for a
       guest; the read never throws. */
    getSavedListings(),
  ]);

  /*
   * The first-run question, gated here and nowhere else.
   *
   * Home is where sign-up redirects and where the OAuth callback returns, so
   * this is the honest meaning of "first entry to the app". Putting the gate in
   * the shell layout instead would have made every consumer route a trapdoor,
   * including the welcome screen's own way out.
   *
   * `askIntent` is false unless the person is signed in, has stated nothing,
   * and has never been asked, so a skip is permanent and a returning user
   * never sees this branch again. It comes from the profile read the overview
   * already did, not a second query.
   */
  if (overview.askIntent) redirect("/welcome");

  /*
   * The featured shelf.
   *
   * The market counts read that stood here came off with the nine market
   * tiles: `GOVERNING-01` draws a category row with NO counts on it, and
   * the product rule is that the tiles drop their counts rather than
   * print a figure `platform_stats()` cannot yet produce honestly. So the page
   * no longer pays for a count nothing draws. The read itself
   * (`market-queries.ts`) was removed on 17 October with no caller left.
   */
  /* UX-04: the Property home's shelf is Property: tenancies and sales. A
     shortlet or a hotel room here opened under Stays and turned the app over. */
  const propertyRows = recommended.filter((listing) => isPropertyMarket(marketOf(listing)));

  /*
   * PERSONALISED BY WHAT THEY SAID (Session 3, W2; handoff section 2: "`/home`
   * ignores the interests it collects").
   *
   * The 18 recommended rows are the whole catalogue's best, and a stated
   * interest in shops is not answered by reordering 18 rows that hold no
   * shop. So the shelf also reads the catalogue for each stated Property
   * kind (at most three, in parallel, through the same repository `/search`
   * uses), puts those rows through the SAME published Recommended formula
   * (`rankRecommended`, `ranking.ts`), and puts them first with the stable
   * partition `/search` uses (`orderByStatedIntent`). Nothing about the
   * formula changes and nothing is paid for: this decides which honest rows
   * are on a six-card shelf, never their rank against each other.
   *
   * A guest, an unread row and an empty answer all get the generic shelf,
   * which is the honest surface. A dedicated personalised read would save
   * the extra round trips; it is request W2-R2 in Session 3's response.
   */
  const { tuning, stated, forThem } = intent;
  const seen = new Set<string>();
  const pooled = [...rankRecommended(forThem), ...propertyRows].filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return isPropertyMarket(marketOf(listing));
  });
  const ordered = orderByStatedIntent(pooled, stated);
  const listings = ordered.slice(0, PREMIUM_SHOWN);
  /* FEATURED LISTINGS: the same ranked pool, the places after the Premium
     carousel's six, so no place is drawn twice one under the other. */
  const featuredMore = ordered.slice(PREMIUM_SHOWN, PREMIUM_SHOWN + FEATURED_MORE);
  const intentApplied = stated.length > 0 && listings.some((listing) => (stated as readonly string[]).includes(listing.kind));

  /*
   * THE FIGURE HOME LEADS WITH (`HomeFigure.tsx`): the account's saved count,
   * drawn only when there is at least one. The area's typical move-in total
   * would lead for everybody else, and has no honest read yet (W2-R1).
   */
  const lead: HomeLeadFigure | null =
    overview.signedIn && savedEntries.length > 0 ? { kind: "saved", count: savedEntries.length } : null;

  /*
   * Whether this person is a seller or an agent who has not finished verifying.
   *
   * Read here rather than inside `VerifyPrompt` because the prompt is a server
   * component that takes a fact, not a component that goes and finds one: the
   * same fact drives the sheet on `/profile`, and two independent reads of it
   * are two chances for the two surfaces to disagree about whether somebody is
   * verified. A renter or buyer never produces a prompt.
   */
  const agentFacts: AgentFacts =
    agentContext.state === "agent"
      ? {
          type: agentContext.agent.type,
          status: agentContext.agent.status,
          verified: agentContext.agent.verified,
        }
      : null;
  const roles = roleStateFrom(agentFacts, mode).roles;

  /*
   * WHERE "MANAGE" GOES, DECIDED BY WHO IS ASKING.
   *
   * Somebody holding a supplier workspace lands on
   * their own properties; somebody holding none lands on the "Add a workspace"
   * chooser. Both states are honest and neither needs a new product.
   *
   * IT READS THE AGENT ROW, WHICH IS WHAT EXISTS TODAY AND NOT WHAT WILL. The
   * fuller answer is the workspace list, which also counts a stays business
   * and a firm, and which B1 is building as `lib/supply/workspaces-queries`.
   * The moment that lands this becomes a read of that list; it is one line and
   * it is recorded in the ledger as owed rather than left to be noticed.
   *
   * AND IT IS NOT AUTHORISATION. Landing on the workspace does not permit a
   * single action there: every route re-gates for itself against the database,
   * which is section 3.5's standing rule.
   */
  const manageHref = agentContext.state === "agent" ? "/agent/listings" : "/profile/setup";

  return (
    <HomeScreen
      t={t}
      locale={locale}
      overview={overview}
      listings={listings}
      roles={roles}
      manageHref={manageHref}
      lead={lead}
      interests={tuning.interests}
      intentApplied={intentApplied}
      featuredMore={featuredMore}
      /* BEST MATCHES: for a signed-in person only, built from what they said
         and kept (their stated kinds, saved searches, saved places). A guest
         has said and kept nothing, so a guest sees Premium, Featured and New.
         Streamed behind a skeleton in the list's own shape. */
      bestMatches={
        overview.signedIn ? (
          <Suspense
            fallback={<HomeListSkeleton shape="tiles" title={t.homeV2.bestTitle} label={t.homeV2.loadingBest} />}
          >
            <BestMatchesStream
              t={t}
              locale={locale}
              interests={tuning.interests}
              pool={ordered}
              saved={savedEntries.map((entry) => entry.listing)}
              onScreen={new Set([...listings, ...featuredMore].map((listing) => listing.id))}
            />
          </Suspense>
        ) : null
      }
      newListings={
        <Suspense
          fallback={<HomeListSkeleton shape="rows" title={t.homeV2.newTitle} label={t.homeV2.loadingNew} />}
        >
          <NewListingsStream t={t} locale={locale} />
        </Suspense>
      }
      upNext={
        /* Streamed, so its three reads never hold up the first paint; it
           draws nothing when there is nothing next (plan item 15). */
        overview.signedIn ? (
          <Suspense fallback={null}>
            <UpNext t={t} locale={locale} />
          </Suspense>
        ) : null
      }
    />
  );
}
