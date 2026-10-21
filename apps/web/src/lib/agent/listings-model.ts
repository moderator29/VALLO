

import { takesShape } from "@/lib/listings/unit-shape";
import {
  type PeriodWords,
  type BuildCondition,
  type Furnishing,
  type LandTenure,
  type ListingIntent,
  type RatePeriod,
  type RentPeriod,
  type SaleStatus,
} from "../listings/pricing";

export type {
  BuildCondition,
  Furnishing,
  LandTenure,
  ListingIntent,
  RatePeriod,
  RentPeriod,
  SaleStatus,
} from "../listings/pricing";

/**
 * Agent listing input schemas and the canonical submit gate.
 *
 * Two audiences share this file, which is the whole point. The wizard imports
 * it in the browser to light up its checklist as the agent works, and the
 * server actions import it to decide what may actually enter the review queue.
 * One definition of "ready", so the checklist can never promise something the
 * server then refuses.
 *
 * Drafts are forgiving on purpose: a half-typed listing must always be
 * saveable, because a lost draft is a lost listing and a lost listing is lost
 * supply. Only the title is asked for to save. Everything else is asked for at
 * submit, where the quality gate lives (HYBRID_INVENTORY section 5).
 *
 * Money crosses the boundary exactly once, here: naira text in,
 * Math.round(naira * 100) integer kobo out. Nothing downstream ever sees a
 * float.
 *
 * THREE MARKETS, THREE MONEY SHAPES, and the wizard has to ask for exactly one
 * of them. `intent` is the first question and everything after it follows:
 *
 *   SALE      an asking price, the title being sold, and a sale status.
 *   TENANCY   a rent and its cycle, plus the fee breakdown a Nigerian tenant
 *             is actually quoted: caution, service charge, agency, legal,
 *             agreement, and the total to find at the door.
 *   SHORT STAY a rate per night, or per head for a restaurant table.
 *
 * Which of the two rent shapes applies is decided by the property type through
 * `isTenancy`, not by another question: a shop is let by the year and a
 * shortlet is let by the night, and asking somebody to confirm that is asking
 * them to restate what they already told us.
 */

/* ------------------------------------------------------------- constants */

/**
 * THE MEDIA A LISTING NEEDS: photos and walkthrough videos, counted together.
 *
 * Three items before it may be sent for review, the first of which (the
 * cover) is a photo; five is what the wizard recommends. The lister's
 * checklist, `submitListing` and the reviewer's admission checklist all read
 * these two numbers, so the three can never ask for different counts (the
 * reviewer's reason asked for five while the gate asked for four).
 */
export const MIN_MEDIA = 3;

export const RECOMMENDED_MEDIA = 5;

/** Kept for the callers that still name photos; it is the media minimum. */
export const MIN_PHOTOS = MIN_MEDIA;

/** The database allows positions 0 to 9, so ten photos per listing. */
export const MAX_PHOTOS = 10;

/** Narrower than this and the photo blurs on a modern phone screen. */
export const MIN_PHOTO_WIDTH = 1600;

/** Words of description required before submit. */
export const MIN_DESCRIPTION_WORDS = 40;

/** Title bounds, applied after trimming and collapsing runs of spaces. */
export const MIN_TITLE_LENGTH = 8;

export const MAX_TITLE_LENGTH = 80;

/** A draft may be saved with a title this short; submit still needs eight. */
export const MIN_DRAFT_TITLE_LENGTH = 2;

/** One hundred million naira, in kobo. Above this is a typing accident. */
export const MAX_PRICE_KOBO = 100_000_000_00;

/**
 * The ceiling on the SALE side: the asking price, the total to buy and the
 * costs on top of them. Fifty billion naira, in kobo.
 *
 * The one ceiling above was written for a rent and was applied to a sale too,
 * so an asking price over a hundred million naira could not even be saved as
 * a draft ("That amount looks too high"), while the wizard's own placeholder
 * suggested 180,000,000 and a Lagos house routinely sells for several times
 * that. Agency and legal fees on a sale are a percentage of it, so they share
 * this ceiling rather than the rent's. The figure is still a guard against a
 * slipped key, and where exactly it sits is the founder's call.
 */
export const MAX_SALE_PRICE_KOBO = 50_000_000_000_00;

/* ------------------------------------------------------------------ media

   The upload ceilings, stated once and enforced in three places.

   THE BROWSER IS NOT A LIMIT. Anything checked only in JavaScript is a courtesy
   to an honest person and is removed by anybody who opens the network tab. So
   each of these numbers appears three times on purpose, and the three are not
   redundant, they are three different kinds of protection:

     1. HERE, so the uploader can refuse a file before spending somebody's
        Nigerian mobile data pushing a hundred megabytes that will bounce.
     2. On the STORAGE BUCKET, in Postgres, as file_size_limit and
        allowed_mime_types. This is the one that actually holds: it is enforced
        by the storage service against the upload itself, whatever the client
        believes.
     3. In the SERVER ACTION that attaches the object to a listing, which reads
        the object's real size and type back from storage rather than trusting
        what it was told.

   A hundred megabytes and sixty seconds for a video are the owner's numbers
   (12 October): a minute of 1080p phone video, which is what a walkthrough is.
   -------------------------------------------------------------------------- */

/**
 * The ceiling on a WALKTHROUGH. A hundred megabytes, a minute of 1080p. The
 * `listing-videos` bucket was raised to match by
 * `20261013062253_listing_videos_take_a_hundred_megabytes.sql` (applied).
 *
 * It was the ceiling on a photograph too, and that was wrong: the
 * `listing-photos` bucket is capped at ten megabytes
 * (`20260809051809_a_bucket_that_accepts_anything_of_any_size.sql:52-56`), so
 * for every photograph between ten and fifty megabytes the browser said yes,
 * the person spent Nigerian mobile data pushing it, and STORAGE refused it at
 * the end. The three-layer rule above is only worth anything when the three
 * layers agree, and these two did not.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "100MB";

/** The ceiling on a PHOTOGRAPH, matching the bucket exactly. Ten megabytes. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const MAX_PHOTO_LABEL = "10MB";

/** What a listing photo may be. HEIC is here because an iPhone shoots it. */
export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** What a walkthrough may be. QuickTime is here because an iPhone records .mov. */
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

/** Walkthroughs per listing. The database counts them under a lock too. */
export const MAX_VIDEOS = 3;

/**
 * The longest walkthrough a lister may attach, in seconds. The table itself
 * holds up to 1800 (`listing_videos_duration_sane`); a minute is the owner's
 * rule, measured in the browser and checked again by `addVideo`.
 */
export const MAX_VIDEO_SECONDS = 60;

/**
 * Why a chosen file cannot be used, in words, before anything is uploaded.
 * Returns null when it is fine.
 */
export function rejectUpload(
  file: { type: string; size: number },
  allowed: readonly string[],
  /* The ceiling differs by kind and the caller is the only one that knows
     which kind it holds. Defaulting to the video ceiling keeps every existing
     caller reading the same way. */
  maxBytes: number = MAX_UPLOAD_BYTES,
): string | null {
  if (!allowed.includes(file.type)) {
    return "That file type is not one we can accept. Choose a different file.";
  }
  if (file.size > maxBytes) {
    return maxBytes === MAX_PHOTO_BYTES
      ? `That photo is over ${MAX_PHOTO_LABEL}. Most phones can export a smaller copy.`
      : `That file is over ${MAX_UPLOAD_LABEL}. Record a shorter clip, or export it at a lower resolution.`;
  }
  return null;
}

export const PHOTO_TOO_NARROW_MESSAGE =
  "Photos must be at least 1600px wide so they look sharp on every screen.";

/* -------------------------------------------------------- property types */

export type PropertyType =
  | "apartment"
  | "hotel"
  | "home"
  | "villa"
  | "shortlet"
  | "rental"
  | "shop"
  | "office"
  | "land"
  | "restaurant";

export const PROPERTY_TYPE_VALUES = [
  "apartment",
  "hotel",
  "home",
  "villa",
  "shortlet",
  "rental",
  "shop",
  "office",
  "land",
  "restaurant",
] as const satisfies readonly PropertyType[];

export const PROPERTY_TYPES: { value: PropertyType; label: string; blurb: string }[] = [
  { value: "apartment", label: "Apartment", blurb: "A self-contained flat let by the night." },
  { value: "shortlet", label: "Shortlet", blurb: "A furnished stay for a few nights or weeks." },
  { value: "home", label: "Home", blurb: "A whole house guests book by the night." },
  { value: "villa", label: "Villa", blurb: "A large private home with grounds." },
  { value: "hotel", label: "Hotel", blurb: "Rooms in a managed property." },
  {
    value: "rental",
    label: "Rental",
    blurb: "A home let on a yearly tenancy. Priced per year, inspected before payment.",
  },
  { value: "shop", label: "Shop", blurb: "Retail space let by the year." },
  { value: "office", label: "Office", blurb: "Workspace let by the year." },
  { value: "land", label: "Land", blurb: "A plot, priced per year of tenure." },
  /*
   * The one thing on this list nobody sleeps in.
   *
   * Discovery used to fill this category from a Google Places feed: a name, a
   * photo and a pin, with no verified badge, nobody to message and no way to
   * hold anybody a table. The feed is gone and this value is what a restaurant
   * is now, a place somebody here put up, with a message button and a
   * reservation this platform actually holds.
   *
   * Priced per head, which needs no new price period: `YEARLY` below does not
   * contain it, so it files as a nightly figure, and every reader of a
   * restaurant already treats that number as a head price by the rule stated in
   * lib/listings/types.ts.
   */
  {
    value: "restaurant",
    label: "Restaurant",
    blurb: "A place to eat, with tables guests reserve. Priced per head.",
  },
];

/**
 * The tenancy market: let by the year, agreed with the agent, inspected before
 * any money moves, and never reserved by the night. Rentals were the whole of
 * it until shops, offices and land arrived, and every one of those is let the
 * same way, so they take the same path rather than a second one that would
 * drift from it.
 */
const TENANCY: ReadonlySet<PropertyType> = new Set<PropertyType>([
  "rental",
  "shop",
  "office",
  "land",
]);

/** Priced per head rather than per night. One category, stated once. */
const PER_HEAD: ReadonlySet<PropertyType> = new Set<PropertyType>(["restaurant"]);

/** True when this category is let on a tenancy rather than by the night. */
export function isTenancy(type: PropertyType | null | undefined): boolean {
  return type ? TENANCY.has(type) : false;
}

/**
 * Retained under its old name because the agent workspace, the wizard and the
 * card model all call it, and the question it answers has not changed: is this
 * the yearly market or the nightly one.
 */
export function isRental(type: PropertyType | null | undefined): boolean {
  return isTenancy(type);
}

/** The rate cycle a short-stay category is quoted in. */
export function ratePeriodFor(type: PropertyType | null | undefined): RatePeriod {
  return type && PER_HEAD.has(type) ? "guest" : "night";
}

/** The words the UI puts after a price, per market and intent, from the reader's `t.agentListings.pricing.period`. */
export function priceSuffixFor(
  type: PropertyType | null | undefined,
  words: PeriodWords,
  intent: ListingIntent = "rent",
): string {
  if (intent === "sale") return words.sale;
  if (isTenancy(type)) return words.year;
  return words[ratePeriodFor(type)];
}

/**
 * Retained for the agent workspace and the wizard, which print "per year" or
 * "per night" beside a figure. A sale is not a period and is not answered here;
 * callers that can be looking at one call `priceSuffixFor` with the intent.
 */
export function pricePeriodLabel(type: PropertyType | null | undefined, words: PeriodWords): string {
  return isTenancy(type) ? words.year : words.night;
}

/* ------------------------------------------------------- intent and money */

export const LISTING_INTENT_CHOICES: {
  value: ListingIntent;
  label: string;
  blurb: string;
}[] = [
  { value: "rent", label: "To let", blurb: "Somebody pays to occupy it. Rent, or a nightly rate." },
  { value: "sale", label: "For sale", blurb: "Somebody buys it outright, with a title to transfer." },
];

export const RENT_PERIOD_CHOICES: { value: RentPeriod; label: string }[] = [
  { value: "year", label: "Per year" },
  { value: "quarter", label: "Per quarter" },
  { value: "month", label: "Per month" },
];

export const TENURE_CHOICES: { value: LandTenure; label: string; blurb: string }[] = [
  {
    value: "certificate_of_occupancy",
    label: "Certificate of Occupancy",
    blurb: "A C of O issued by the state. The strongest title on offer.",
  },
  {
    value: "governors_consent",
    label: "Governor's Consent",
    blurb: "A previously granted title, transferred with the governor's consent.",
  },
  {
    value: "deed_of_assignment",
    label: "Deed of Assignment",
    blurb: "The transfer document, without consent obtained yet.",
  },
  { value: "gazette", label: "Gazette", blurb: "Excised land recorded in the state gazette." },
  { value: "freehold", label: "Freehold", blurb: "Held outright, with no term." },
  { value: "leasehold", label: "Leasehold", blurb: "Held for a fixed term of years." },
];

export const SALE_STATUS_CHOICES: { value: SaleStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "under_offer", label: "Under offer" },
  { value: "sold", label: "Sold" },
];

export const FURNISHING_CHOICES: { value: Furnishing; label: string }[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi furnished" },
  { value: "fully_furnished", label: "Fully furnished" },
];

export const CONDITION_CHOICES: { value: BuildCondition; label: string }[] = [
  { value: "newly_built", label: "Newly built" },
  { value: "renovated", label: "Renovated" },
  { value: "old", label: "Older build" },
  { value: "off_plan", label: "Off plan" },
];

/** A year built earlier than this is a typing accident, not a building. */
export const MIN_YEAR_BUILT = 1800;

/** Off plan is real, so a few years ahead of today is a legitimate answer. */
export const YEAR_BUILT_LOOKAHEAD = 5;

/** The tallest building in Nigeria has 30 floors. 200 leaves room for the world. */
export const MAX_FLOORS = 200;

/** Shortest tenancy anybody offers is a month; longest anybody quotes is a decade. */
export const MAX_TENANCY_MONTHS = 120;

/* --------------------------------------------------------------- states */

/**
 * The 37 seeded state codes (36 states plus the FCT). Held here so the gate
 * can run in the browser without a round trip; the select still renders the
 * names read from the states table, and the foreign key remains the authority.
 */
export const STATE_CODES = [
  "AB", "AD", "AK", "AN", "BA", "BY", "BE", "BO", "CR", "DE", "EB", "ED",
  "EK", "EN", "GO", "IM", "JI", "KD", "KN", "KT", "KE", "KO", "KW", "LA",
  "NA", "NI", "OG", "ON", "OS", "OY", "PL", "RI", "SO", "TA", "YO", "ZA",
  "FC",
] as const;

export const STATE_CODE_SET = new Set<string>(STATE_CODES);

/* -------------------------------------------------- light, water, access */

/**
 * The three questions a Nigerian guest asks before the price.
 *
 * The amenity list already carried "Backup Power" and "Running Water" as tick
 * boxes, and a tick box cannot tell a Band A feeder apart from a generator
 * somebody runs from seven to eleven. Those two chips stay for now so nothing a
 * host has already ticked disappears, but the structured answers below are what
 * the listing page reads and what search will filter on, because four spellings
 * of borehole cannot be filtered at all.
 */
export const POWER_GRID_VALUES = ["BAND_A", "MOSTLY_ON", "PATCHY", "RARELY", "NONE"] as const;

export type PowerGrid = (typeof POWER_GRID_VALUES)[number];

export const POWER_GRID_CHOICES: { value: PowerGrid; label: string; blurb: string }[] = [
  { value: "BAND_A", label: "Band A", blurb: "20 hours a day or more from the grid" },
  { value: "MOSTLY_ON", label: "Mostly on", blurb: "Light most of the day, with gaps" },
  { value: "PATCHY", label: "Patchy", blurb: "On and off through the day" },
  { value: "RARELY", label: "Rarely on", blurb: "A few hours at best" },
  { value: "NONE", label: "No grid supply", blurb: "Nothing from the distribution company" },
];

export const POWER_BACKUP_VALUES = [
  "NONE",
  "GENERATOR",
  "INVERTER",
  "SOLAR",
  "GENERATOR_INVERTER",
] as const;

export type PowerBackup = (typeof POWER_BACKUP_VALUES)[number];

export const POWER_BACKUP_CHOICES: { value: PowerBackup; label: string }[] = [
  { value: "NONE", label: "No backup" },
  { value: "GENERATOR", label: "Generator" },
  { value: "INVERTER", label: "Inverter" },
  { value: "SOLAR", label: "Solar" },
  { value: "GENERATOR_INVERTER", label: "Generator and inverter" },
];

export const WATER_SUPPLY_VALUES = [
  "TREATED_MAINS",
  "BOREHOLE",
  "PUMPED_STORAGE",
  "TANKER",
  "NONE",
] as const;

export type WaterSupply = (typeof WATER_SUPPLY_VALUES)[number];

export const WATER_SUPPLY_CHOICES: { value: WaterSupply; label: string; blurb: string }[] = [
  { value: "TREATED_MAINS", label: "Treated mains", blurb: "Running water from the mains" },
  { value: "BOREHOLE", label: "Borehole", blurb: "The property's own borehole" },
  { value: "PUMPED_STORAGE", label: "Pumped storage", blurb: "Tank filled and pumped through" },
  { value: "TANKER", label: "Tanker delivery", blurb: "Water is bought in and stored" },
  { value: "NONE", label: "No running water", blurb: "Water is fetched" },
];

export const MAX_BACKUP_HOURS = 24;

export const MAX_ESTATE_NAME = 120;

export const MAX_GATE_DIRECTIONS = 600;

export const MAX_SECURITY_PHONE = 32;

export const MAX_ACCESS_CODE = 40;


/* ------------------------------------------------------------ amenities */

/** The 15 seeded amenity codes with their labels, for chips and validation. */
export const AMENITY_CHOICES: { code: string; label: string }[] = [
  { code: "wifi", label: "Free WiFi" },
  { code: "ac", label: "Air Conditioning" },
  { code: "tv", label: "TV" },
  { code: "kitchen", label: "Kitchen" },
  { code: "parking", label: "Parking" },
  { code: "pool", label: "Swimming Pool" },
  { code: "gym", label: "Gym" },
  { code: "security", label: "Security" },
  { code: "elevator", label: "Elevator" },
  { code: "furnished", label: "Furnished" },
  { code: "balcony", label: "Balcony" },
  { code: "garden", label: "Garden" },
  { code: "laundry", label: "Laundry" },
  { code: "generator", label: "Backup Power" },
  { code: "water", label: "Running Water" },
  { code: "shower", label: "Hot Shower" },
  { code: "breakfast", label: "Breakfast" },
  { code: "workspace", label: "Workspace" },
];

export const AMENITY_CODE_SET = new Set(AMENITY_CHOICES.map((a) => a.code));

/* ------------------------------------------------------------- helpers */

/** Trim, then collapse every run of whitespace to a single space. */
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Words in a body of text, whitespace separated, punctuation ignored. */
export function countWords(value: string | null | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^\p{L}\p{N}'-]+/gu, " ").trim();
  return cleaned.length === 0 ? 0 : cleaned.split(/\s+/).length;
}

// Naira as typed: digits, optional thousands commas, at most two decimals.
const NAIRA_RE = /^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/;

/**
 * Parse naira text to integer kobo. The only float in the money path, and it
 * is rounded away in the same expression. Returns null when the text is not a
 * well-formed naira amount.
 */
export function parseNairaToKobo(raw: string): number | null {
  const trimmed = raw.trim().replace(/^₦/, "").trim();
  if (trimmed.length === 0) return null;
  if (!NAIRA_RE.test(trimmed)) return null;
  const naira = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(naira) || naira < 0) return null;
  return Math.round(naira * 100);
}

/** Kobo back to the naira text an input should show when a draft is restored. */
export function koboToNairaInput(minor: number | null | undefined): string {
  if (!minor || minor <= 0) return "";
  const kobo = minor % 100;
  const naira = (minor - kobo) / 100;
  return kobo === 0 ? String(naira) : `${naira}.${String(kobo).padStart(2, "0")}`;
}

/**
 * A FEE as the text its input should show when a draft is restored.
 *
 * Not `koboToNairaInput`, which reads zero as "nothing typed": right for a
 * rent or a price, where zero is never an answer, and wrong for a fee, where a
 * stated zero is the answer "no agency fee". Restoring that zero as an empty
 * box turned "No agency fee" into "Not declared" on the lister's own screen,
 * and the next save sent the empty box back as a clear.
 */
export function feeToNairaInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor) || minor < 0) return "";
  return minor === 0 ? "0" : koboToNairaInput(minor);
}

export const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

/**
 * For the draft fields a lister can take back: an empty string still means
 * "not sent, leave the column as it is", and null now means "cleared, empty
 * the column". `emptyToUndefined` folds both into the first, which is why a
 * fee, an address or a count the lister deleted came back on the next visit
 * and stayed on the stored listing.
 */
export const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

/**
 * Everything the gate needs to judge a listing, whether the values are sitting
 * in wizard state or have just been read back out of Postgres.
 */
export type SubmitSubject = {
  title: string | null | undefined;
  description: string | null | undefined;
  propertyType: PropertyType | null | undefined;
  stateCode: string | null | undefined;
  city: string | null | undefined;
  area: string | null | undefined;
  /** To let, or for sale. Absent reads as "rent", the column default. */
  intent: ListingIntent | null | undefined;
  /** Tenancy rent in kobo, with the cycle it is quoted in. */
  rentMinor: number | null | undefined;
  rentPeriod: RentPeriod | null | undefined;
  /** Short-stay rate in kobo, per night or per head. */
  rateMinor: number | null | undefined;
  ratePeriod: RatePeriod | null | undefined;
  /** Asking price in kobo, and the title being sold with it. */
  salePriceMinor: number | null | undefined;
  tenure: LandTenure | null | undefined;
  bedrooms: number | null | undefined;
  bathrooms: number | null | undefined;
  /**
   * V-66: the unit's shape. Undefined means it could not be read (a database
   * without the column) and is not asked for; null means unanswered.
   */
  unitShape?: string | null | undefined;
  amenityCount: number;
  photoCount: number;
  /** Walkthrough videos; they count toward `MIN_MEDIA` with the photos. */
  videoCount?: number;
  /** True when a photo sits at position 0, which is the cover. */
  hasCover: boolean;
  /**
   * V-13. The lister's stated move-in total in kobo, and the parts they named
   * beside it. Optional so every existing caller still compiles; both real
   * callers (the wizard and `submitListing`) pass them.
   */
  moveInStatedMinor?: number | null;
  moveInPartsMinor?: ReadonlyArray<number | null | undefined>;
};

/** One unmet requirement, named by the field the agent has to go back to. */
export type GateRequirement = { field: string; message: string };

/**
 * THE canonical gate. The wizard checklist and `submitListing` both call this,
 * so what an agent is told and what the server enforces cannot drift apart.
 * An empty array means the listing is ready for review.
 */
export function submitRequirements(subject: SubmitSubject): GateRequirement[] {
  const unmet: GateRequirement[] = [];

  const title = collapseSpaces(subject.title ?? "");
  if (title.length < MIN_TITLE_LENGTH) {
    unmet.push({
      field: "title",
      message: `Give the listing a title of at least ${MIN_TITLE_LENGTH} characters.`,
    });
  } else if (title.length > MAX_TITLE_LENGTH) {
    unmet.push({
      field: "title",
      message: `Shorten the title to ${MAX_TITLE_LENGTH} characters or fewer.`,
    });
  }

  const words = countWords(subject.description);
  if (words < MIN_DESCRIPTION_WORDS) {
    unmet.push({
      field: "description",
      message: `Describe the property in at least ${MIN_DESCRIPTION_WORDS} words. You have ${words} so far.`,
    });
  }

  if (!subject.propertyType) {
    unmet.push({ field: "propertyType", message: "Choose what kind of property this is." });
  }

  const mediaCount = subject.photoCount + (subject.videoCount ?? 0);
  if (mediaCount < MIN_MEDIA) {
    unmet.push({
      field: "photos",
      message: `Add at least ${MIN_MEDIA} photos or videos. You have ${mediaCount}.`,
    });
  } else if (subject.photoCount === 0 || !subject.hasCover) {
    unmet.push({
      field: "photos",
      message: "Put a photo first. The first item is the cover, and a cover has to be a photo.",
    });
  }

  const stateCode = (subject.stateCode ?? "").trim().toUpperCase();
  if (!STATE_CODE_SET.has(stateCode)) {
    unmet.push({ field: "stateCode", message: "Choose the state the property is in." });
  }
  if (collapseSpaces(subject.city ?? "").length < 2) {
    unmet.push({ field: "city", message: "Enter the city, for example Lagos." });
  }
  if (collapseSpaces(subject.area ?? "").length < 2) {
    unmet.push({ field: "area", message: "Enter the area, for example Lekki Phase 1." });
  }

  if (subject.amenityCount < 1) {
    unmet.push({ field: "amenities", message: "Choose at least one amenity guests will find." });
  }

  /*
   * The money gate, which is three different gates.
   *
   * A listing that says nothing about what it costs is the single most useless
   * thing this catalogue can publish, so exactly one of the three shapes has to
   * be complete, and which one is not the lister's choice: intent picks sale
   * against everything else, and the property type picks tenancy against short
   * stay. Each branch names the field the wizard has to send the agent back to,
   * so the checklist and the server refusal point at the same input.
   */
  const intent: ListingIntent = subject.intent ?? "rent";
  if (intent === "sale") {
    if ((subject.salePriceMinor ?? 0) <= 0) {
      unmet.push({ field: "salePrice", message: "Set the asking price in naira." });
    }
    /* A buyer's first question in Nigeria is what title they are taking, and a
       sale listing that will not answer it is the shape of every land scam
       there has ever been. It is required rather than encouraged. */
    if (!subject.tenure) {
      unmet.push({
        field: "tenure",
        message: "Say what title comes with the property, for example Certificate of Occupancy.",
      });
    }
  } else if (isTenancy(subject.propertyType)) {
    if ((subject.rentMinor ?? 0) <= 0) {
      unmet.push({ field: "rent", message: "Set the rent in naira." });
    }
    if (!subject.rentPeriod) {
      unmet.push({ field: "rentPeriod", message: "Say whether the rent is per year, quarter or month." });
    }
    /* V-13. A stated total above the named parts publishes a fee nobody named.
       It is refused here, on the server and in the wizard alike, until the
       gap is itemised in the fee boxes or taken out of the total. */
    const stated = subject.moveInStatedMinor;
    if (typeof stated === "number" && Number.isInteger(stated) && stated > 0) {
      const parts = (subject.moveInPartsMinor ?? []).reduce<number>(
        (sum, part) => sum + (typeof part === "number" && Number.isInteger(part) && part > 0 ? part : 0),
        0,
      );
      if (stated > parts) {
        unmet.push({
          field: "totalMoveIn",
          message: "Your stated total is more than the parts you listed. Name what the difference is for in the fee boxes, or remove it from the total.",
        });
      }
    }
  } else {
    if ((subject.rateMinor ?? 0) <= 0) {
      unmet.push({
        field: "rate",
        message:
          subject.propertyType === "restaurant"
            ? "Set the price per head in naira."
            : "Set the price per night in naira.",
      });
    }
    if (!subject.ratePeriod) {
      unmet.push({ field: "ratePeriod", message: "Say what the rate covers." });
    }
  }

  /* V-66: a home to let or sell says its shape. Stays, shops, offices and
     plots have none. Skipped when the shape could not be read at all. */
  if (
    subject.unitShape !== undefined &&
    !subject.unitShape &&
    subject.propertyType &&
    takesShape(subject.propertyType)
  ) {
    unmet.push({ field: "unitShape", message: "Choose the shape of the home." });
  }
  if ((subject.bedrooms ?? -1) < 0) {
    unmet.push({ field: "bedrooms", message: "Say how many bedrooms the property has." });
  }
  /* A plot of land has no bathroom. Asking would be a gate no land listing
     could ever pass, which is a worse failure than a missing field: the
     category would exist in search and be impossible to supply. */
  if (subject.propertyType !== "land" && (subject.bathrooms ?? 0) < 1) {
    unmet.push({ field: "bathrooms", message: "Say how many bathrooms the property has." });
  }

  return unmet;
}

/** The gate's verdict shaped for the ActionResult envelope's fieldErrors. */
export function gateFieldErrors(unmet: GateRequirement[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of unmet) {
    if (!(item.field in out)) out[item.field] = item.message;
  }
  return out;
}

/** The one sentence shown above the list of unmet requirements. */
export const GATE_SUMMARY_MESSAGE =
  "A few things are still needed before this listing can go for review. Each one is listed below.";

/* -------------------------------------------------------------- statuses */

/**
 * The listing status vocabulary and how it renders. These live here rather
 * than beside the queries because the agent workspace is a client component
 * and the query module is server-only: a value imported across that boundary
 * would drag the server module into the browser bundle.
 */
export type ListingStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MORE_INFO_REQUIRED"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "SUSPENDED";

/**
 * The English fallback labels. THE LIVE COPY IS THE DICTIONARY.
 *
 * `agentListings.workspace.status` is what the lister actually reads and this
 * record is re-exported and read by nothing, so these two strings must not be
 * allowed to disagree: a second English copy that drifts is worse than no
 * second copy.
 *
 * AND THERE IS A LIVE DEFECT IN BOTH OF THEM, recorded here rather than half
 * fixed. `APPROVED` says "Approved", which is true and reads as finished. It
 * is not finished: approve and publish are two separate acts and the second is
 * OURS, so a lister sees a success-coloured "Approved" chip on a property that
 * is not in search, with nothing saying a step is pending on our side. The
 * notification that made it worse by telling them to publish it themselves is
 * fixed (`lib/admin/actions.ts`), and so is the email. The CHIP is not, for
 * two reasons that are both about not making things worse: the live string
 * lives in a shared dictionary namespace, and the colour
 * comes from `toneForStatus`, which maps APPROVED to success for bookings,
 * payments, support tickets and six other families at once. Both belong to
 * whoever owns those, and both are in the report.
 */
export const STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  MORE_INFO_REQUIRED: "More information needed",
  APPROVED: "Approved",
  PUBLISHED: "Live",
  REJECTED: "Not accepted",
  SUSPENDED: "Suspended",
};

/**
 * Status colours, named for the STATE rather than for the colour.
 *
 * The four locked meanings live in packages/design-tokens/src/tokens.css. This
 * map only says which listing status is which state; it never picks a colour.
 * Everything a host is still waiting on is "pending", whatever the wording of
 * the step, and everything the platform has stopped is "rejected".
 */
export const STATUS_TONE: Record<
  ListingStatus,
  "neutral" | "pending" | "approved" | "rejected"
> = {
  DRAFT: "neutral",
  SUBMITTED: "pending",
  UNDER_REVIEW: "pending",
  MORE_INFO_REQUIRED: "pending",
  APPROVED: "approved",
  PUBLISHED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "rejected",
};
