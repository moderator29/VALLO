/**
 * THE WORDS OF /pro (SW11). Moved from `apps/web/src/app/(app)/pro/pro-copy.ts`
 * so the other three locales can translate it through `withFallback`. The shape
 * matches the original key for key.
 *
 * NO FIGURE LIVES HERE: the price, the monthly quotas, the list of what each
 * plan includes and the trial's length are read from the plan rows. This file
 * only words them.
 */
export const proEn = {
  metaTitle: "Vallo Pro",
  title: "Vallo Pro",

  hero: {
    lead: "Go deeper with",
    last: "Pro.",
    body: "Pro adds tools to the workspace you already run: your leads, your calendar, your numbers. Everything free on Vallo today stays free.",
    fragment: {
      source: "Agent mode",
      title: "Pro view",
      line: "Appears in your workspace once you hold a plan",
      words: ["Leads", "Clients", "Analytics"],
    },
  },

  plan: {
    label: "Your plan",
    signedOutTitle: "Sign in to see your plan",
    signedOutBody: "Your plan lives with your account.",
    signIn: "Sign in",
    unknownTitle: "We could not check your plan just now",
    unknownBody: "Nothing has changed on your account. Try again in a moment.",
    retry: "Try again",
    freeBody: "Everything you use today is included, at no cost.",
    heldBody: "Turn on Pro view from the switch in your workspace.",
    heldSoon: "Its tools arrive in your workspace as they open.",
    heldUntil: "Current until {date}",
    heldOpen: "No end date",
    current: "Current",
  },

  detail: {
    pickLabel: "Plans",
    price: "{price} a month",
    trial: "{days}-day free trial",
    stats: {
      included: "Included",
      price: "A month",
      trial: "Free trial",
      trialValue: "{days} days",
    },
    none: "The plans could not be shown just now. Nothing has changed on your account.",
  },

  quotas: {
    listing_boost: {
      one: "{count} Boost a month",
      other: "{count} Boosts a month",
      reason: "A week in a marked slot on your area's page and its searches.",
      icon: "trending-up",
    },
    listing_spotlight: {
      one: "{count} Spotlight a month",
      other: "{count} Spotlights a month",
      reason: "Two weeks in the Promoted carousel at the top of your area and its searches.",
      icon: "eye",
    },
    listing_featured: {
      one: "{count} Featured a month",
      other: "{count} Featured a month",
      reason: "A month on the front door, the city page, your area and matching searches.",
      icon: "grid",
    },
    listing_prime: {
      one: "{count} Everywhere a month",
      other: "{count} Everywhere a month",
      reason: "Everything Featured gets, plus the saved-search and area digests and the map.",
      icon: "chart-bar",
    },
  },

  perks: {
    deep_analytics: { claim: "Deep analytics", reason: "What each listing is doing, week by week.", icon: "chart-bar" },
    pro_badge: { claim: "Pro badge", reason: "Shows you hold Vallo Pro. It is not a verification mark.", icon: "circle-check" },
    priority_support: { claim: "Priority support", reason: "Your questions are answered before the general queue.", icon: "users" },
    team_members: { claim: "Team members", reason: "Your colleagues work under one account.", icon: "user-check" },
    command_centre: { claim: "Command centre", reason: "Your listings, bookings and enquiries in one view.", icon: "clipboard-list" },
    bulk_tools: { claim: "Bulk tools", reason: "Change many listings at once.", icon: "file-text" },
    export: { claim: "Export", reason: "Take your records out as a file.", icon: "receipt" },
  },

  promises: {
    label: "How Pro will work",
    rows: [
      {
        icon: "circle-check",
        title: "Free stays free",
        sub: "Listing, messaging and saving stay free. Pro adds depth, it never takes something away.",
      },
      {
        icon: "eye",
        title: "No locked buttons",
        sub: "The Pro switch appears in your workspace only once you hold a plan. Nobody else ever sees a greyed control.",
      },
      {
        icon: "receipt",
        title: "The price, before you pay",
        sub: "What a plan costs and what it includes are shown on one plain sheet before anything is charged.",
      },
    ],
  },

  planWords: {
    pro: { short: "Pro", line: "For an individual agent or landlord.", tag: "Pro" },
    business: { short: "Business", line: "For an agency, a hotel or serviced apartments.", tag: "Top plan" },
  },
};
