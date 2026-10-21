/**
 * THE COUNTED NOUNS, IN A FILE OF THEIR OWN (Track M performance).
 *
 * `countOf` ("3 bedrooms") runs in the browser on cards, maps and sheets, and
 * it needs only these tables. They used to live inside each locale's whole
 * dictionary, so a card that printed one count shipped every word of every
 * language. Each locale file still carries its table as `units`, imported
 * from here, so the dictionaries have exactly the shape they had.
 */
import type { PluralForms } from "../plural";

/**
 * DOC-22: every counted phrase the product prints, as `plural()` forms.
 *
 * These replaced about seventy hand-written `n === 1 ? "x" : "xs"` tests in
 * components, which decided the grammar of every language at once and could
 * never be translated. A phrase that carries a verb ("{count} reports have")
 * is a whole form here, because agreement differs by language as much as the
 * noun does. Yoruba, Hausa and Igbo fall back to these English forms until a
 * translator supplies them (`fallback.ts`); `Intl` picks the category, so a
 * locale with only `other` simply never asks for `one`.
 *
 * Read through `countOf(n, "noun", locale)` in `@vallo/i18n`.
 */
export const unitsEn = {
  bedrooms: { one: "1 bedroom", other: "{count} bedrooms" },
  beds: { one: "1 bed", other: "{count} beds" },
  baths: { one: "1 bath", other: "{count} baths" },
  bathrooms: { one: "1 bathroom", other: "{count} bathrooms" },
  toilets: { one: "1 toilet", other: "{count} toilets" },
  hours: { one: "1 hour", other: "{count} hours" },
  days: { one: "1 day", other: "{count} days" },
  minutes: { one: "1 minute", other: "{count} minutes" },
  seats: { one: "1 seat", other: "{count} seats" },
  months: { one: "1 month", other: "{count} months" },
  nights: { one: "1 night", other: "{count} nights" },
  guests: { one: "1 guest", other: "{count} guests" },
  adults: { one: "1 adult", other: "{count} adults" },
  children: { one: "1 child", other: "{count} children" },
  members: { one: "1 member", other: "{count} members" },
  comments: { one: "1 comment", other: "{count} comments" },
  replies: { one: "1 reply", other: "{count} replies" },
  localGovernments: {
    one: "1 local government",
    other: "{count} local governments",
  },
  places: { one: "1 place", other: "{count} places" },
  facilities: { one: "1 facility", other: "{count} facilities" },
  rooms: { one: "1 room", other: "{count} rooms" },
  visits: { one: "1 visit", other: "{count} visits" },
  referrals: { one: "1 referral", other: "{count} referrals" },
  payouts: { one: "1 payout", other: "{count} payouts" },
  invitations: { one: "1 invitation", other: "{count} invitations" },
  people: { one: "1 person", other: "{count} people" },
  homes: { one: "1 home", other: "{count} homes" },
  roomTypes: { one: "1 room type", other: "{count} room types" },
  ratePlans: { one: "1 rate", other: "{count} rates" },
  serviceWindows: { one: "1 service window", other: "{count} service windows" },
  windows: { one: "1 window", other: "{count} windows" },
  stars: { one: "1 star", other: "{count} stars" },
  photos: { one: "1 photo", other: "{count} photos" },
  videos: { one: "1 video", other: "{count} videos" },
  results: { one: "1 result", other: "{count} results" },
  cuisines: { one: "1 cuisine", other: "{count} cuisines" },
  reports: { one: "1 report", other: "{count} reports" },
  heldItems: { one: "1 held item", other: "{count} held items" },
  documents: { one: "1 document", other: "{count} documents" },
  decisions: { one: "1 decision", other: "{count} decisions" },
  stays: { one: "1 stay", other: "{count} stays" },
  spaces: { one: "1 space", other: "{count} spaces" },
  reviews: { one: "1 review", other: "{count} reviews" },
  lines: { one: "1 line", other: "{count} lines" },
  things: { one: "1 thing", other: "{count} things" },
  digitsToGo: {
    one: "1 more digit to go.",
    other: "{count} more digits to go.",
  },
  /* Phrases whose verb agrees with the count. */
  reportsWaiting: { one: "{count} report has", other: "{count} reports have" },
  findingsResolved: {
    one: "{count} finding has",
    other: "{count} findings have",
  },
  examplesLeftOut: {
    one: "{count} example listing is",
    other: "{count} example listings are",
  },
  reviewsAre: { one: "{count} review is", other: "{count} reviews are" },
  enquiriesAre: { one: "{count} enquiry is", other: "{count} enquiries are" },
  businesses: { one: "1 business", other: "{count} businesses" },
  matches: { one: "1 match", other: "{count} matches" },
  entries: { one: "1 entry", other: "{count} entries" },
  cities: { one: "1 city", other: "{count} cities" },
  examples: { one: "1 example", other: "{count} examples" },
  reviewExamples: {
    one: "Review 1 example",
    other: "Review all {count} examples",
  },
  exampleProperties: {
    one: "1 example property",
    other: "{count} example properties",
  },
  liveListings: { one: "1 live listing", other: "{count} live listings" },
  earlierStops: { one: "One earlier stop", other: "{count} earlier stops" },
  minutesAgo: { one: "1 minute ago", other: "{count} minutes ago" },
  daysAgo: { one: "yesterday", other: "{count} days ago" },
  daysWaiting: { one: "1 day waiting", other: "{count} days waiting" },
  examplesAre: { one: "1 example is", other: "{count} examples are" },
  confirmedStaysAre: {
    one: "One confirmed stay is",
    other: "{count} confirmed stays are",
  },
  moreNights: { one: "another night", other: "{count} more nights" },
  thingsStopLive: {
    one: "1 thing stops it going live",
    other: "{count} things stop it going live",
  },
  peopleSoFar: {
    one: "One person has so far.",
    other: "{count} people have so far.",
  },
  walkthroughVideos: {
    one: "Walkthrough video",
    other: "Walkthrough videos ({count})",
  },
  amenitiesChosen: {
    one: "1 amenity chosen.",
    other: "{count} amenities chosen.",
  },
  listingsPutBack: {
    one: "One listing was put back.",
    other: "{count} listings were put back.",
  },
  staysStillAhead: {
    one: "One confirmed stay was still ahead when this landed. It was never cancelled and that guest keeps it.",
    other:
      "{count} confirmed stays were still ahead when this landed. None were cancelled and those guests keep them.",
  },
  listingsBack: {
    one: "One listing is back where it was.",
    other: "{count} listings are back where they were.",
  },
  stoppedBefore: {
    one: "Stopped once before.",
    other: "Stopped {count} times before.",
  },
  liveListingsComeDown: {
    one: "Their one live listing comes down and returns where it was if this is lifted.",
    other:
      "All {count} of their live listings come down and return where they were if this is lifted.",
  },
  listingsCameDown: {
    one: "One listing came down.",
    other: "{count} listings came down.",
  },
  payoutAccounts: {
    one: "This is the account your payouts are sent to.",
    other: "Your payouts go here. You have {count} accounts on file.",
  },
  requestsWaiting: {
    one: "One request is waiting on your answer.",
    other: "{count} requests are waiting on your answer.",
  },
  photographsOnRecord: {
    one: " has one photograph, and it is the one guests see first.",
    other: " has {count} photographs.",
  },
  quarters: { one: "1 quarter", other: "{count} quarters" },
  years: { one: "1 year", other: "{count} years" },
  tablesBooked: {
    one: "One table is still booked here.",
    other: "{count} tables are still booked here.",
  },
  thingsMissing: {
    one: "One thing is still missing: {item}.",
    other: "{count} things are still missing before you can send this.",
  },
  newPlacesMatch: {
    one: "A new place matches {label}",
    other: "{count} new places match {label}",
  },
  newPlacesMatchSaved: {
    one: "A new place matches your saved searches",
    other: "{count} new places match your saved searches",
  },
  listingsCited: {
    one: "Answered from 1 published listing{place}.",
    other: "Answered from {count} published listings{place}.",
  },
  propertiesLive: {
    one: "One property under it is live and bookable.",
    other: "{count} properties under it are live and bookable.",
  },
  yourBusinessTrading: { other: "Your business is still trading." },
  businessesStillTrading: {
    one: "{count} of your businesses is still trading.",
    other: "{count} of your businesses are still trading.",
  },
  /* Integration pass: the last hand-inflected phrases (admin, host desk, agent, spoken money). */
  accounts: { one: "1 account", other: "{count} accounts" },
  consoleKeys: { one: "1 key", other: "{count} keys" },
  payments: { one: "1 payment", other: "{count} payments" },
  requestsAre: { one: "1 request is", other: "{count} requests are" },
  ofThemAre: { one: "{count} of them is", other: "{count} of them are" },
  liveListingsHave: {
    one: "One live listing has",
    other: "{count} live listings have",
  },
  roomsLeft: { one: "1 room left", other: "{count} rooms left" },
  nightsClosed: { one: "1 night closed", other: "{count} nights closed" },
  reviewsOfYourStays: {
    one: "1 review of your stays",
    other: "{count} reviews of your stays",
  },
  keysRevoked: {
    one: "1 key revoked for the console.",
    other: "{count} keys revoked for the console.",
  },
  usDollars: { one: "US dollar", other: "US dollars" },
  pounds: { one: "pound", other: "pounds" },
  /* Schedule a visit: the note's counter and a day's open times. */
  charactersLeft: { one: "1 character left", other: "{count} characters left" },
  openTimes: { one: "1 open time", other: "{count} open times" },
} satisfies Record<string, PluralForms>;

export type UnitNoun = keyof typeof unitsEn;

/** Yoruba: one category, `other`, for every count including one. */
export const unitsYo = {
  nights: { other: "alẹ́ {count}" },
  /* The word the viewing windows draft already used ("ilé {count}"); native review owed. */
  homes: { other: "ilé {count}" },
  guests: { other: "àlejò {count}" },
  adults: { other: "àgbàlagbà {count}" },
  children: { other: "ọmọdé {count}" },
} satisfies Partial<Record<UnitNoun, Partial<PluralForms>>>;

/** Hausa: `one` and `other`. */
export const unitsHa = {
  nights: { one: "dare ɗaya", other: "darare {count}" },
  /* From the viewing windows draft ("gidaje {count}"); native review owed. */
  homes: { one: "gida ɗaya", other: "gidaje {count}" },
  guests: { one: "baƙo ɗaya", other: "baƙi {count}" },
  adults: { one: "babba ɗaya", other: "manya {count}" },
  children: { one: "yaro ɗaya", other: "yara {count}" },
} satisfies Partial<Record<UnitNoun, Partial<PluralForms>>>;

/** Igbo: one category, `other`, for every count including one. */
export const unitsIg = {
  nights: { other: "abalị {count}" },
  /* The word the viewing windows draft already used ("ụlọ {count}"); native review owed. */
  homes: { other: "ụlọ {count}" },
  guests: { other: "ọbịa {count}" },
  adults: { other: "okenye {count}" },
  children: { other: "nwa {count}" },
} satisfies Partial<Record<UnitNoun, Partial<PluralForms>>>;
