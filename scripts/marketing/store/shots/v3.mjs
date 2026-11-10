/**
 * The store set for the upgraded platform (10 November 2026): the same
 * system as premium.mjs (one night ground, the headline on the same
 * baselines, one big straight handset, the pop-out containers, the 3D
 * objects and the round badges), redrawn on the new screens: the new dock
 * with Vallo Circle at its centre, Vallo Roommates, the property pages, the
 * stays and tables, the saved shortlist and the passport.
 *
 * Order: Home, the listing, the one connected pair (the stays home across
 * the seam) in the first swipe, then the new places, then the rest.
 *
 * Copy follows DESIGN.md section 2 and HANDOFF: no em dashes, "verified"
 * only about people, no promise words, no invented numbers. Rental payment
 * is not open on Vallo yet and the wallet is hidden, so no image promises a
 * payment, a refund or a balance. Every figure a card prints is printed on
 * the screen under it.
 */
import { std, staysPairOpts, pair } from "./premium.mjs";
import { RECIPES } from "./furniture/v3.mjs";

const r = (n) => ({ bare: true, ...(RECIPES[n] ?? {}) });

export const SHOTS_V3 = [
  std(1, "find-your-next-home-in-nigeria", "v3-home", ["Find your next *home*", "in Nigeria"], r(1)),
  std(2, "the-move-in-total-before-you-call", "v3-listing", ["The move-in total,", "before you call"], r(2)),
  ...pair(
    { n: 3, slug: "hotels-shortlets-and-restaurants", lines: ["Hotels, shortlets", "and restaurants"], spec: r(3) },
    { n: 4, slug: "book-a-room-in-a-few-taps", lines: ["Book a room", "in a few taps"], spec: r(4) },
    staysPairOpts("v3-stays"),
  ),
  std(5, "ask-share-and-learn-in-vallo-circle", "v3-circle", ["Ask, share and learn", "in Vallo *Circle*"], r(5)),
  std(6, "find-a-roommate-or-a-room-to-share", "v3-roommates", ["Find a *roommate*", "or a room to share"], r(6)),
  std(7, "every-fee-added-up", "v3-listing-cost", ["Every fee,", "added up"], r(7)),
  std(8, "see-what-people-confirmed", "v3-roommates-2", ["See what people", "*confirmed*"], r(8)),
  std(9, "save-favourites-compare-later", "v3-saved", ["Save favourites,", "*compare* later"], r(9)),
  std(10, "ask-the-ai-assistant-any-time-of-day", "assistant", ["Ask the AI assistant", "any time of day"], r(10)),
  std(11, "see-the-stay-before-you-book", "sc-stay", ["See the stay", "*before* you book"], r(11)),
  std(12, "find-a-restaurant-you-love", "v3-restaurant", ["Find a restaurant", "you *love*"], r(12)),
  std(13, "search-homes-across-nigeria", "v3-search", ["*Search* homes", "across Nigeria"], r(13)),
  std(14, "filter-down-to-what-you-need", "v3-filters", ["Filter down", "to what you need"], r(14)),
  std(15, "rooms-near-your-school", "v3-schools", ["Find rooms", "near your *school*"], r(15)),
  std(16, "meet-first-then-decide", "v3-safety", ["Meet first,", "then *decide*"], r(16)),
  std(17, "every-update-in-one-place", "v3-notifications", ["Every update,", "in one place"], r(17)),
  std(18, "vallo-never-holds-your-money", "payments", ["Vallo *never* holds", "your money"], r(18)),
  std(19, "your-passport-you-choose", "v3-passport", ["Your *passport*,", "you choose"], r(19)),
  std(20, "vallo-real-estate-done-right", "v3-welcome", ["Vallo. Real estate,", "done right."], { sub: "Homes, hotels, shortlets and restaurants.", ...r(20) }),
];
