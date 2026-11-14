import type { UiIconName } from "@/design-system/icons/UiIcon";

/**
 * WHAT "DISCOVER VALLO" IS FOR, decided before a line of it was drawn
 * (CRAFT_DOCTRINE section 7, design before build).
 *
 * THE JOB. Not a second landing page. `components/site/landing/LandingBody.tsx`
 * already tells a stranger why to trust Vallo, and its own comment is a record
 * of the founder cutting it from ten rooms to seven to six to five, twice in
 * one evening. A seventeen section showcase would rebuild the exact thing he
 * cut four times.
 *
 * So this surface answers the question the landing cannot: a person who came
 * to Vallo to rent one flat has no idea the deal room, roommates or the
 * passport exist. THE JOB IS WHAT ELSE VALLO DOES FOR YOU, AND A DOOR INTO
 * EACH. It is useful signed out and signed in, which is what the brief asks,
 * because the doors are the real product either way.
 *
 * THE SUBJECT of each section is the capability, shown by a fragment of the
 * real product rather than an illustration of one (PREMIUM-STANDARD, the
 * governing level: "real UI fragments as illustration").
 *
 * EVERY CLAIM IS TRUE. No figure appears here that the platform cannot prove,
 * no photograph stands in for a listing, and the money sentence is the one
 * from `lib/money/copy.ts`, which is the only wording the Terms allow.
 */

export type ShowcaseSection = {
  key: string;
  /** The eyebrow: who this is for, in the reader's own terms. */
  eyebrow: string;
  title: string;
  /** One sentence. If it needs two, the section is doing two jobs. */
  body: string;
  /** The door's words and where it goes. Every one is a route that exists. */
  door: { label: string; href: string };
  icon: UiIconName;
  /** What a real build needs beyond this proposal. Shown in the report, not on the page. */
  needs: string;
};

export const SHOWCASE: readonly ShowcaseSection[] = [
  {
    key: "find",
    eyebrow: "Everyone",
    title: "Find a place, and know what it really costs",
    body:
      "Homes to rent or buy, stays by the night, restaurants and workspaces, in one search. Every listing shows what you pay to move in, not just the rent.",
    door: { label: "Search", href: "/search" },
    icon: "search",
    needs: "A real catalogue read. The preview uses the harness fixtures.",
  },
  {
    key: "offer",
    eyebrow: "Buyers and renters",
    title: "Make an offer, and negotiate in writing",
    body:
      "Send what you are willing to pay, with your terms. Counteroffers, the seller's answers and every change are kept in one deal room you can read back.",
    door: { label: "Offers", href: "/offers" },
    icon: "hand-coins",
    needs: "Nothing new. Offers and the deal room are built; this is the door that is missing.",
  },
  {
    key: "roommates",
    eyebrow: "Sharing the rent",
    title: "Find people to share with",
    body:
      "Say what you are looking for and what you are like to live with, and meet people looking for the same thing near you.",
    door: { label: "Roommates", href: "/roommates" },
    icon: "users",
    needs: "Nothing new. Roommates is built.",
  },
  {
    key: "circle",
    eyebrow: "Your area",
    title: "Ask the people who already live there",
    body:
      "Circle is where neighbours answer the questions a listing cannot: the water, the landlord, the road in the rain.",
    door: { label: "Circle", href: "/circle" },
    icon: "circle-people",
    needs: "Nothing new. Circle and the feed are built.",
  },
  {
    key: "trust",
    eyebrow: "Before you pay anybody",
    title: "Check who you are dealing with",
    body:
      "Look up an agent before you send money, see what a listing has actually been checked for, and keep the whole conversation where it can be read back.",
    door: { label: "Check an agent", href: "/check" },
    icon: "shield-check",
    needs: "Nothing new. The agent check and the listing checks are built.",
  },
] as const;

/**
 * THE SEVENTEEN THE BRIEF LISTED, AND WHY ELEVEN ARE NOT HERE. Kept beside
 * the sections so the refusals travel with the thing that caused them.
 */
export const REFUSED: readonly { items: string; reason: string }[] = [
  {
    items: "Discover properties, Buy and rent, Save and compare properties, Explore personalised discovery, Access personalised recommendations, Discover verified opportunities",
    reason:
      "Six names for one capability: finding a place. Printing them as six sections is the long page of repetitive cards the founder refused. They are one section, Find a place.",
  },
  {
    items: "Make an Offer, Negotiate directly, Track offers",
    reason: "One journey, told once. Splitting it into three would make an offer sound like three products.",
  },
  {
    items: "Manage bookings, Manage listings, Connect with agents",
    reason:
      "Account and supply-side areas, reached from the workspace a person already has. A showcase that lists them is a menu, and the shell is already the menu.",
  },
  {
    items: "Communicate securely",
    reason:
      "Messaging is a channel, not a destination, and it is already shown inside the deal room and the agent check. The word secure is a claim, and it would need a specific true meaning before it is printed.",
  },
  {
    items: "Build communities",
    reason: "Kept, but as Circle, which is what it is called in the product. A showcase that renames features teaches the wrong vocabulary.",
  },
] as const;
