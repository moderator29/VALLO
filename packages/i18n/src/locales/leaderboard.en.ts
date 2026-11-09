/**
 * Leaderboard copy (SW11). Moved from:
 *   - lib/leaderboard/copy.ts
 *
 * Only the static string constants live here. Functions that build strings
 * from parameters stay in their original module and read from this dictionary.
 */

export const leaderboardEn = {
  title: "Leaderboard",

  groupLabel: { referrals: "Referrals", top: "Top on Vallo" },

  boardLabel: {
    referrals: "Referrals",
    property: "Agents and landlords",
    hotels: "Hotels and stays",
    restaurants: "Restaurants",
  },

  boardShort: {
    referrals: "Referrals",
    property: "Agents",
    hotels: "Hotels",
    restaurants: "Restaurants",
  },

  unitForms: {
    referrals: { one: "referral", other: "referrals" },
    property: { one: "deal", other: "deals" },
    hotels: { one: "stay", other: "stays" },
    restaurants: { one: "table", other: "tables" },
  },

  boardMeasure: {
    referrals: "Ranked by friends who joined with your link.",
    property: "Ranked by rent deals paid through Vallo.",
    hotels: "Ranked by completed stays booked on Vallo.",
    restaurants: "Ranked by completed table reservations.",
  },

  kindLabel: {
    member: "Member",
    agent: "Agent",
    landlord: "Landlord",
    firm: "Firm",
    hotel: "Hotel",
    resort: "Resort",
    guest_house: "Guest house",
    serviced_apartments: "Serviced apartments",
    shortlet_operator: "Shortlets",
    restaurant: "Restaurant",
  },

  scopeLabel: { city: "City", global: "Global" },

  periodLabel: { month: "This month", all: "All time" },

  emptyBody: {
    referrals: "Nobody has a referral on this board yet. Invite a friend; it counts as soon as they sign up.",
    property:
      "No rent deal has been paid through Vallo here yet. The first verified agent or landlord to close one takes the top spot.",
    hotels:
      "No stay has been completed here yet. The first approved hotel to host a guest through Vallo takes the top spot.",
    restaurants:
      "No reservation has been completed here yet. The first approved restaurant to seat a guest through Vallo takes the top spot.",
  },

  climbAction: {
    referrals: { label: "Invite friends", href: "/settings/invite" },
    property: { label: "Become an agent", href: "/profile/setup" },
    hotels: { label: "Add your hotel", href: "/profile/setup?side=stays" },
    restaurants: { label: "Add your restaurant", href: "/profile/setup?side=stays" },
  },

  notLiveTitle: "Leaderboards open soon",
  notLiveBody:
    "The boards are built and waiting for their switch. When they open they rank real activity only, so nobody is shown until they have earned a place.",

  errorTitle: "The board did not load",
  errorBody: "Nothing is wrong with your account. Pull down or try again in a moment.",

  climbSteps: {
    referrals: [
      { title: "Share your link", body: "Every friend who signs up with your link is yours. Nobody can claim them after." },
      { title: "It counts when they join", body: "A friend counts the moment they finish signing up with your link." },
      { title: "Climb every month", body: "The month board starts fresh on the first. All time keeps every referral." },
    ],
    property: [
      { title: "Get approved", body: "Only approved agents, landlords and firms are ranked. Approval is free." },
      { title: "Close through Vallo", body: "Each rent deal paid through Vallo counts once, for the listing's agent and their firm." },
      { title: "Climb every month", body: "The month board starts fresh on the first. Your city is where the home is." },
    ],
    hotels: [
      { title: "Get approved", body: "Only approved, published hotels and stays are ranked." },
      { title: "Host through Vallo", body: "Each stay booked on Vallo counts once the guest has checked out." },
      { title: "Climb every month", body: "The month board starts fresh on the first. All time keeps every stay." },
    ],
    restaurants: [
      { title: "Get approved", body: "Only approved, published restaurants are ranked." },
      { title: "Seat guests through Vallo", body: "Each reservation counts once it is marked completed." },
      { title: "Climb every month", body: "The month board starts fresh on the first. All time keeps every table." },
    ],
  },

  explainerTitle: "How to climb",
  explainerDone: "Got it",

  privacyLine:
    "Boards show a public name, a count and a city. Never an amount, a phone number or an email.",
  optOutLabel: "Show me on leaderboards",
  optOutBody: "Turn this off to take yourself off every board. You can come back any time.",

  shareTitle: "Share your rank",
  shareAction: "Share",
  shareCopy: "Copy link",
  shareCopied: "Link copied",

  notOnBoard: "You are not on this board yet",
};
