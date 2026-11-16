import type { IntelligenceKind } from "./contract";
import { placeWords } from "./places";

/**
 * VALLO INTELLIGENCE: THE WORDS IT KNOWS.
 *
 * Plain data, read by `understand.ts`. Three lists:
 *
 *   SPELLING   misspellings people actually type, to the word they meant.
 *              Offered as "Did you mean", never applied silently.
 *   KIND_WORDS the words that point at a kind of result, and the marketplace
 *              kinds (`ListingKind`) they narrow to where they do.
 *   AMENITIES  the words for the amenity codes the listings schema holds
 *              (`public.amenities.code`, read 16 November 2026: ac, balcony,
 *              elevator, garden, generator, gym, kitchen, laundry, parking,
 *              pool, security, tv, water, wifi, workspace). No code outside
 *              that set is ever produced.
 */

/** Misspelling (lower case) to the word meant. */
export const SPELLING: Readonly<Record<string, string>> = {
  appartment: "apartment",
  appartments: "apartments",
  apartmant: "apartment",
  apartmants: "apartments",
  aparment: "apartment",
  aparments: "apartments",
  apartmnt: "apartment",
  appartement: "apartment",
  resturant: "restaurant",
  resturants: "restaurants",
  restaurent: "restaurant",
  restaurents: "restaurants",
  restuarant: "restaurant",
  restuarants: "restaurants",
  restraunt: "restaurant",
  restraunts: "restaurants",
  resturent: "restaurant",
  hotle: "hotel",
  hotles: "hotels",
  hotell: "hotel",
  hotal: "hotel",
  hottel: "hotel",
  accomodation: "accommodation",
  accomodations: "accommodations",
  acommodation: "accommodation",
  accommadation: "accommodation",
  acomodation: "accommodation",
  shorlet: "shortlet",
  shorlets: "shortlets",
  shortlett: "shortlet",
  shotlet: "shortlet",
  roomate: "roommate",
  roomates: "roommates",
  rommate: "roommate",
  roomie: "roommate",
  ofer: "offer",
  offr: "offer",
  offfer: "offer",
  ofers: "offers",
  bedrom: "bedroom",
  bedroon: "bedroom",
  bedrooom: "bedroom",
  berdroom: "bedroom",
  furnised: "furnished",
  furnshed: "furnished",
  furnishd: "furnished",
  swiming: "swimming",
  swimmimg: "swimming",
  propety: "property",
  proprty: "property",
  porperty: "property",
  properies: "properties",
  propertys: "properties",
  bunglow: "bungalow",
  duplx: "duplex",
  abja: "abuja",
  abujah: "abuja",
  lagoss: "lagos",
  lekky: "lekki",
  ikoyy: "ikoyi",
  surelere: "surulere",
  gwarimpa: "gwarinpa",
  savd: "saved",
  bookins: "bookings",
  mesages: "messages",
  messeges: "messages",
};

export type KindWord = { kind: IntelligenceKind; listingKinds?: string[]; intent?: "rent" | "buy" | "stay" };

/** Words (lower case, singular and plural) that point at a kind. Longest phrases are matched first. */
export const KIND_WORDS: Readonly<Record<string, KindWord>> = {
  apartment: { kind: "property" },
  apartments: { kind: "property" },
  flat: { kind: "property" },
  flats: { kind: "property" },
  house: { kind: "property" },
  houses: { kind: "property" },
  home: { kind: "property" },
  homes: { kind: "property" },
  property: { kind: "property" },
  properties: { kind: "property" },
  rental: { kind: "property", intent: "rent" },
  rentals: { kind: "property", intent: "rent" },
  land: { kind: "property", listingKinds: ["land"] },
  plot: { kind: "property", listingKinds: ["land"] },
  plots: { kind: "property", listingKinds: ["land"] },
  shop: { kind: "property", listingKinds: ["shop"] },
  shops: { kind: "property", listingKinds: ["shop"] },
  office: { kind: "property", listingKinds: ["office"] },
  offices: { kind: "property", listingKinds: ["office"] },
  "office space": { kind: "property", listingKinds: ["office"] },
  hotel: { kind: "stay", listingKinds: ["hotel"], intent: "stay" },
  hotels: { kind: "stay", listingKinds: ["hotel"], intent: "stay" },
  shortlet: { kind: "stay", listingKinds: ["shortlet"], intent: "stay" },
  shortlets: { kind: "stay", listingKinds: ["shortlet"], intent: "stay" },
  "short let": { kind: "stay", listingKinds: ["shortlet"], intent: "stay" },
  "short lets": { kind: "stay", listingKinds: ["shortlet"], intent: "stay" },
  "serviced apartment": { kind: "stay", intent: "stay" },
  "serviced apartments": { kind: "stay", intent: "stay" },
  "guest house": { kind: "stay", intent: "stay" },
  airbnb: { kind: "stay", listingKinds: ["shortlet"], intent: "stay" },
  accommodation: { kind: "stay", intent: "stay" },
  accommodations: { kind: "stay", intent: "stay" },
  lodge: { kind: "stay", intent: "stay" },
  stay: { kind: "stay", intent: "stay" },
  stays: { kind: "stay", intent: "stay" },
  resort: { kind: "stay", intent: "stay" },
  restaurant: { kind: "restaurant" },
  restaurants: { kind: "restaurant" },
  "place to eat": { kind: "restaurant" },
  "places to eat": { kind: "restaurant" },
  eatery: { kind: "restaurant" },
  eateries: { kind: "restaurant" },
  buka: { kind: "restaurant" },
  dinner: { kind: "restaurant" },
  lunch: { kind: "restaurant" },
  brunch: { kind: "restaurant" },
  breakfast: { kind: "restaurant" },
  food: { kind: "restaurant" },
  roommate: { kind: "roommate" },
  roommates: { kind: "roommate" },
  "room mate": { kind: "roommate" },
  "room mates": { kind: "roommate" },
  "room-mate": { kind: "roommate" },
  flatmate: { kind: "roommate" },
  flatmates: { kind: "roommate" },
  "flat share": { kind: "roommate" },
  "room share": { kind: "roommate" },
  "shared apartment": { kind: "roommate" },
  agent: { kind: "person" },
  agents: { kind: "person" },
  landlord: { kind: "person" },
  landlords: { kind: "person" },
  host: { kind: "person" },
  hosts: { kind: "person" },
  people: { kind: "person" },
  person: { kind: "person" },
  member: { kind: "person" },
  members: { kind: "person" },
  community: { kind: "community" },
  communities: { kind: "community" },
  circle: { kind: "community" },
  circles: { kind: "community" },
  group: { kind: "community" },
  groups: { kind: "community" },
  post: { kind: "post" },
  posts: { kind: "post" },
  discussion: { kind: "post" },
  discussions: { kind: "post" },
};

/** The marketplace's own words for to-let and for-sale that `parseWords` does not read. */
export const INTENT_WORDS: readonly [RegExp, "rent" | "buy" | "stay"][] = [
  [/\b(?:to\s+buy|buy(?:ing)?|purchase|for\s+sale|on\s+sale)\b/g, "buy"],
  [/\b(?:to\s+rent|for\s+rent|rent(?:ing)?|to\s+let|lease)\b/g, "rent"],
];

/** Amenity phrases to the amenity code. Longest first when matched. */
export const AMENITY_WORDS: readonly [RegExp, string][] = [
  [/\bswimming\s+pools?\b/g, "pool"],
  [/\bpools?\b/g, "pool"],
  [/\b(?:gym|gymnasium|fitness\s+(?:centre|center|room))\b/g, "gym"],
  [/\b(?:wi-?fi|internet|broadband)\b/g, "wifi"],
  [/\b(?:car\s*park|parking(?:\s+space)?)\b/g, "parking"],
  [/\b(?:generator|gen|24\s*(?:hours?|hrs?|\/7)\s*(?:power|light|electricity)|constant\s+(?:power|light))\b/g, "generator"],
  [/\b(?:air\s*-?\s*condition(?:ing|er|ed)?|aircon|a\/c|ac)\b/g, "ac"],
  [/\bbalcon(?:y|ies)\b/g, "balcony"],
  [/\b(?:lift|elevator)\b/g, "elevator"],
  [/\bgardens?\b/g, "garden"],
  [/\b(?:24\s*(?:hours?|hrs?)\s*)?security\b/g, "security"],
  [/\b(?:laundry|washing\s+machine)\b/g, "laundry"],
  [/\b(?:workspace|work\s+space|desk)\b/g, "workspace"],
  [/\b(?:borehole|running\s+water|water\s+supply)\b/g, "water"],
];

/** The personal records a member can ask for by name. */
export type PersonalTarget = "saved" | "offers" | "bookings" | "messages" | "viewings" | "searches" | "listings";

export const PERSONAL_WORDS: readonly [RegExp, PersonalTarget][] = [
  [/\bsaved\s+searches\b|\bsearch\s+alerts?\b/g, "searches"],
  [/\b(?:saved|save|favou?rites?|wishlist|shortlist(?:ed)?|liked)\b/g, "saved"],
  [/\b(?:offers?|bids?)\b/g, "offers"],
  [/\b(?:bookings?|reservations?|trips?|plans)\b/g, "bookings"],
  [/\b(?:messages?|chats?|inbox|conversations?)\b/g, "messages"],
  [/\b(?:viewings?|inspections?|visits?)\b/g, "viewings"],
  [/\blistings\b/g, "listings"],
];

/** Words that carry no search meaning on their own. */
export const STOP_WORDS = new Set(
  (
    "a an and the in on at near around within close by of for to from with without me my i im i'm we our you your " +
    "find show search get see looking look want need please some any good nice best top great " +
    "is are was be there here that this which what where who can could would should do does " +
    "available one ones place places area areas thing things vallo app"
  ).split(/\s+/),
);

/** Words that are not typos even though the spelling list does not hold them. */
export const KNOWN_WORDS = new Set<string>([
  ...STOP_WORDS,
  ...Object.values(SPELLING),
  ...Object.keys(KIND_WORDS).filter((k) => !k.includes(" ")),
  "bedroom", "bedrooms", "bathroom", "bathrooms", "furnished", "unfurnished", "semi", "fully", "serviced",
  "cheap", "cheapest", "affordable", "budget", "luxury", "new", "newest", "latest", "listed", "week", "month",
  "today", "tonight", "tomorrow", "weekend", "night", "nights", "guest", "guests", "adults", "family", "couple",
  "under", "below", "above", "over", "between", "million", "thousand", "naira", "sale", "rent", "buy", "lease",
  "make", "made", "previous", "past", "recent", "how", "list", "listing", "listings", "help", "guide", "change",
  "email", "password", "settings", "account", "verify", "verification", "payment", "payments", "wallet",
  "swimming", "pool", "gym", "parking", "security", "generator", "garden", "balcony", "laundry", "kitchen",
  "duplex", "bungalow", "terrace", "detached", "penthouse", "maisonette", "self", "contain", "mini", "quarters",
  "offer", "offers", "saved", "bookings", "messages", "viewings", "inspection", "inspections",
]);

/** The words the spelling check may suggest, beyond the fixed list. */
export function spellingVocabulary(): string[] {
  return [...new Set([...KNOWN_WORDS, ...placeWords()])].filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}
