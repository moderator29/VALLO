/**
 * listings-schema: the zod schemas the SERVER validates with.
 *
 * Everything a client component may import (the constants, labels, limits,
 * copy and pure helpers) lives in `./listings-model` and is re-exported here, so a server
 * module still imports from this file as before. A client component imports
 * the model, never this file, because this file builds zod schemas at import
 * time and zod's classic API is 64 KB gzipped in every client chunk that
 * reaches it (W13, chunk 2008felnqkn1d).
 */

import { z } from "zod";
import { PARKING_TYPES, WASTE_DISPOSALS } from "@/lib/listings/compound";
import { ESTATE_TYPES, SERVICE_COVERS } from "@/lib/listings/service";
import { UNIT_SHAPES } from "@/lib/listings/unit-shape";
import { FLOODING } from "@/lib/around/pulse";
import {
  BUILD_CONDITION_VALUES,
  FURNISHING_VALUES,
  LAND_TENURE_VALUES,
  LISTING_INTENT_VALUES,
  RATE_PERIOD_VALUES,
  RENT_PERIOD_VALUES,
  SALE_STATUS_VALUES,
} from "../listings/pricing";
import {
  AMENITY_CHOICES,
  AMENITY_CODE_SET,
  MAX_ACCESS_CODE,
  MAX_BACKUP_HOURS,
  MAX_ESTATE_NAME,
  MAX_FLOORS,
  MAX_GATE_DIRECTIONS,
  MAX_MEDIA,
  MAX_PHOTOS,
  MAX_PRICE_KOBO,
  MAX_SALE_PRICE_KOBO,
  MAX_SECURITY_PHONE,
  MAX_TENANCY_MONTHS,
  MAX_TITLE_LENGTH,
  MAX_VIDEO_SECONDS,
  MIN_DRAFT_TITLE_LENGTH,
  MIN_YEAR_BUILT,
  POWER_BACKUP_VALUES,
  POWER_GRID_VALUES,
  PROPERTY_TYPE_VALUES,
  STATE_CODE_SET,
  WATER_SUPPLY_VALUES,
  YEAR_BUILT_LOOKAHEAD,
  blankToUndefined,
  collapseSpaces,
  emptyToUndefined,
  parseNairaToKobo,
} from "./listings-model";
export * from "./listings-model";

const optionalText = (max: number, tooLong: string) =>
  z.preprocess(
    emptyToUndefined,
    z.string().max(max, tooLong).transform(collapseSpaces).optional(),
  );

const optionalCount = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => {
      const cleared = emptyToUndefined(value);
      if (cleared === undefined) return undefined;
      return typeof cleared === "string" ? Number(cleared) : cleared;
    },
    z.number(message).int(message).min(min, message).max(max, message).optional(),
  );

/* ------------------------------------------------- clearable draft fields
 *
 * The draft's optional fields, in a form a lister can TAKE BACK. Absent, or an
 * empty string, still leaves the column exactly as it was, which is the
 * forgiving-draft rule; null empties it, and null is what the wizard sends for
 * a box the lister cleared. Before these, both meant "leave it", so a deleted
 * agency fee, street address or toilet count stayed on the stored listing,
 * came back on the next visit, and went to review and to the public page as
 * if the lister had never removed it.
 */

const clearableText = (max: number, tooLong: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().max(max, tooLong).transform(collapseSpaces).nullable().optional(),
  );

const clearableCount = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => {
      const cleared = blankToUndefined(value);
      if (cleared === undefined || cleared === null) return cleared;
      return typeof cleared === "string" ? Number(cleared) : cleared;
    },
    z.number(message).int(message).min(min, message).max(max, message).nullable().optional(),
  );

/**
 * Naira text in, integer kobo out, under a ceiling. A rent and its fees use
 * `MAX_PRICE_KOBO`; the sale side uses `MAX_SALE_PRICE_KOBO` (see its note).
 */
const clearableNaira = (message: string, ceiling: number = MAX_PRICE_KOBO) =>
  z.preprocess(
    blankToUndefined,
    z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .transform((raw, ctx) => {
        if (raw === undefined || raw === null) return raw;
        const kobo = parseNairaToKobo(String(raw));
        if (kobo === null) {
          ctx.addIssue({ code: "custom", message });
          return z.NEVER;
        }
        if (kobo > ceiling) {
          ctx.addIssue({
            code: "custom",
            message: "That amount looks too high. Check the figure and try again.",
          });
          return z.NEVER;
        }
        return kobo;
      }),
  );

/**
 * A positive decimal, for the one measurement on a listing that is not a whole
 * number. Land is sold in fractions of a square metre and rounding it to an
 * integer would misstate the plot, so `listings.size_sqm` is numeric and this
 * is the only field in the wizard that may carry a fraction. It is still not
 * money and never becomes money.
 */
const clearableDecimal = (message: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .transform((raw, ctx) => {
        if (raw === undefined || raw === null) return raw;
        const value = Number(String(raw).replace(/,/g, "").trim());
        if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) {
          ctx.addIssue({ code: "custom", message });
          return z.NEVER;
        }
        // Two decimal places is more precision than any survey plan states.
        return Math.round(value * 100) / 100;
      }),
  );

/** An ISO calendar date, the shape both `<input type="date">` and Postgres use. */
const clearableDate = (message: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, message)
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), message)
      .nullable()
      .optional(),
  );

const uuid = (message: string) => z.string().trim().uuid(message);

/* --------------------------------------------------------- draft schema */

/**
 * What the wizard sends on every autosave. Title carries the only hard
 * requirement, because a draft has to survive an agent who typed one line and
 * put the phone down.
 */
export const draftInputSchema = z.object({
  id: z.preprocess(emptyToUndefined, uuid("We could not identify that listing.").optional()),
  title: z
    .string("Give your listing a title so we can save it.")
    .transform(collapseSpaces)
    .pipe(
      z
        .string()
        .min(MIN_DRAFT_TITLE_LENGTH, "Give your listing a title so we can save it.")
        .max(MAX_TITLE_LENGTH, `Keep the title under ${MAX_TITLE_LENGTH} characters.`),
    ),
  description: clearableText(4000, "Keep the description under 4000 characters."),
  propertyType: z.preprocess(emptyToUndefined, z.enum(PROPERTY_TYPE_VALUES).optional()),
  stateCode: z.preprocess(
    blankToUndefined,
    z
      .string()
      .transform((value) => value.trim().toUpperCase())
      .refine((value) => STATE_CODE_SET.has(value), "Choose a state from the list.")
      .nullable()
      .optional(),
  ),
  city: clearableText(80, "Keep the city under 80 characters."),
  area: clearableText(80, "Keep the area under 80 characters."),
  address: clearableText(200, "Keep the address under 200 characters."),
  landmark: clearableText(120, "Keep the landmark under 120 characters."),
  /* Never null: both columns are NOT NULL, and the wizard always sends a count. */
  bedrooms: optionalCount(0, 20, "Bedrooms can be 0 to 20."),
  bathrooms: optionalCount(0, 20, "Bathrooms can be 0 to 20."),
  toilets: clearableCount(0, 20, "Toilets can be 0 to 20."),
  parkingSpaces: clearableCount(0, 50, "Parking spaces can be 0 to 50."),
  floor: clearableCount(-5, MAX_FLOORS, `The floor can be -5 to ${MAX_FLOORS}.`),
  totalFloors: clearableCount(1, MAX_FLOORS, `A building has 1 to ${MAX_FLOORS} floors.`),
  sizeSqm: clearableDecimal("Enter the size in square metres, for example 120."),

  /* ------------------------------------------------------------- intent
     The first question, and the one every money field below depends on. A
     draft may be saved without it, in which case the row keeps whatever it
     had, which is 'rent' by column default. */
  intent: z.preprocess(emptyToUndefined, z.enum(LISTING_INTENT_VALUES).optional()),

  /* ---------------------------------------------------------- to let, yearly
     A tenancy: the rent, its cycle, and everything else somebody has to find
     before the keys change hands. Every fee is optional because agents
     genuinely quote different subsets, and an unstated fee is rendered as
     unstated rather than as zero. */
  rentNaira: clearableNaira("Enter the rent in naira, for example 4,500,000."),
  rentPeriod: z.preprocess(emptyToUndefined, z.enum(RENT_PERIOD_VALUES).optional()),
  rentNegotiable: z.preprocess(emptyToUndefined, z.boolean().optional()),
  cautionDepositNaira: clearableNaira("Enter the caution deposit in naira."),
  serviceChargeNaira: clearableNaira("Enter the service charge in naira."),
  serviceChargePeriod: z.preprocess(emptyToUndefined, z.enum(RENT_PERIOD_VALUES).optional()),
  agencyFeeNaira: clearableNaira("Enter the agency fee in naira."),
  legalFeeNaira: clearableNaira("Enter the legal fee in naira."),
  agreementFeeNaira: clearableNaira("Enter the agreement fee in naira."),
  totalMoveInNaira: clearableNaira("Enter the total move-in cost in naira."),
  minimumTenancyMonths: clearableCount(
    1,
    MAX_TENANCY_MONTHS,
    `The shortest tenancy can be 1 to ${MAX_TENANCY_MONTHS} months.`,
  ),
  availableFrom: clearableDate("Enter the date as YYYY-MM-DD."),
  furnished: z.preprocess(blankToUndefined, z.enum(FURNISHING_VALUES).nullable().optional()),

  /* --------------------------------------------------------- to let, nightly
     A shortlet, a hotel room, a restaurant table. One figure and the cycle it
     is quoted in, which the category decides rather than the lister. Null
     clears the figure; the column is NOT NULL, so the action stores a zero. */
  rateNaira: clearableNaira("Enter the rate in naira, for example 85,000."),
  ratePeriod: z.preprocess(emptyToUndefined, z.enum(RATE_PERIOD_VALUES).optional()),

  /* -------------------------------------------------------------- for sale */
  salePriceNaira: clearableNaira(
    "Enter the asking price in naira, for example 180,000,000.",
    MAX_SALE_PRICE_KOBO,
  ),
  priceNegotiable: z.preprocess(emptyToUndefined, z.boolean().optional()),

  /* WHAT A BUYER ACTUALLY PAYS. The sale side's twin of the move-in model,
     and it had none: an asking price, a tenure and a sale status were the
     whole of it. A hundred and eighty million in Lagos is routinely two
     hundred million by the time the deed is signed. Every field is optional
     because sellers quote different subsets, and an unstated cost renders as
     unstated and never as zero. */
  saleAgencyFeeNaira: clearableNaira("Enter the agency fee in naira.", MAX_SALE_PRICE_KOBO),
  saleLegalFeeNaira: clearableNaira("Enter the legal fee in naira.", MAX_SALE_PRICE_KOBO),
  governorsConsentFeeNaira: clearableNaira(
    "Enter the Governor's consent fee in naira.",
    MAX_SALE_PRICE_KOBO,
  ),
  stampDutyNaira: clearableNaira("Enter the stamp duty in naira.", MAX_SALE_PRICE_KOBO),
  surveyRegistrationFeeNaira: clearableNaira(
    "Enter the survey and registration fee in naira.",
    MAX_SALE_PRICE_KOBO,
  ),
  totalPurchaseNaira: clearableNaira("Enter the total cost to buy in naira.", MAX_SALE_PRICE_KOBO),
  tenure: z.preprocess(blankToUndefined, z.enum(LAND_TENURE_VALUES).nullable().optional()),
  saleStatus: z.preprocess(emptyToUndefined, z.enum(SALE_STATUS_VALUES).optional()),
  yearBuilt: clearableCount(
    MIN_YEAR_BUILT,
    new Date().getUTCFullYear() + YEAR_BUILT_LOOKAHEAD,
    `The year built can be ${MIN_YEAR_BUILT} to ${new Date().getUTCFullYear() + YEAR_BUILT_LOOKAHEAD}.`,
  ),
  condition: z.preprocess(blankToUndefined, z.enum(BUILD_CONDITION_VALUES).nullable().optional()),

  /* Light and water. Undefined means the host has not answered yet and the
     column is left exactly as it was; null is an answer taken back. The
     listing page renders unanswered as unanswered, never as good news. */
  powerGrid: z.preprocess(blankToUndefined, z.enum(POWER_GRID_VALUES).nullable().optional()),
  powerBackup: z.preprocess(blankToUndefined, z.enum(POWER_BACKUP_VALUES).nullable().optional()),
  powerBackupHours: clearableCount(
    0,
    MAX_BACKUP_HOURS,
    `Backup hours can be 0 to ${MAX_BACKUP_HOURS}.`,
  ),
  waterSupply: z.preprocess(blankToUndefined, z.enum(WATER_SUPPLY_VALUES).nullable().optional()),
  prepaidMeter: z.preprocess(emptyToUndefined, z.boolean().optional()),
  /**
   * V-09: the wizard fields a pasted broadcast filled and the lister has not
   * yet confirmed, written beside the draft in the same save. Absent leaves
   * what is stored alone; an empty list clears it.
   */
  broadcastUnconfirmed: z.array(z.string().regex(/^[A-Za-z]{1,40}$/)).max(40).optional(),

  /* V-28. The compound's five answers. NULL clears an answer the lister took
     back (the wizard holds all five and sends null for unanswered); undefined
     leaves the column as it was, like every other draft field. */
  parkingType: z.enum(PARKING_TYPES).nullable().optional(),
  flatsInCompound: z.number().int().min(1, "Enter 1 or more homes.").max(500, "Enter 500 or fewer homes.").nullable().optional(),
  landlordOnSite: z.boolean().nullable().optional(),
  wasteDisposal: z.enum(WASTE_DISPOSALS).nullable().optional(),
  carAccess: z.boolean().nullable().optional(),

  /* V-68. What the service charge covers, how it is charged, and the gate.
     Null clears an answer taken back, undefined leaves the column alone. */
  serviceChargeCovers: z.array(z.enum(SERVICE_COVERS)).max(SERVICE_COVERS.length).nullable().optional(),
  serviceChargeReconciled: z.boolean().nullable().optional(),
  estateType: z.enum(ESTATE_TYPES).nullable().optional(),

  /* V-66. The unit's shape, en-suite rooms and BQ; null clears, undefined
     leaves alone. En-suite rooms are capped at the bedrooms by the database. */
  unitShape: z.enum(UNIT_SHAPES).nullable().optional(),
  ensuiteCount: z.number().int().min(0, "Enter 0 or more rooms.").max(20, "Enter 20 or fewer rooms.").nullable().optional(),
  hasBq: z.boolean().nullable().optional(),

  /* V-41. The lister's flooding answer; null clears, undefined leaves alone. */
  flooding: z.enum(FLOODING).nullable().optional(),
}).superRefine((value, ctx) => {
  /* `listings_floor_within_building`: a sixth floor in a five floor building
     is refused by the database, which reached the lister as "We could not save
     this listing" with nothing pointing at the two boxes. */
  if (typeof value.floor === "number" && typeof value.totalFloors === "number" && value.floor > value.totalFloors) {
    ctx.addIssue({
      code: "custom",
      path: ["floor"],
      message: `The floor is above the top of the building. It has ${value.totalFloors} floors.`,
    });
  }
});

export type DraftInput = z.input<typeof draftInputSchema>;

export type DraftParsed = z.output<typeof draftInputSchema>;

/* --------------------------------------------------- photo and amenities */

export const addPhotoSchema = z.object({
  listingId: uuid("We could not identify that listing."),
  /** `<auth uid>/<listing id>/<uuid>.<ext>` inside the listing-photos bucket. */
  storagePath: z
    .string()
    .trim()
    .min(6, "That upload did not complete. Try the photo again.")
    .max(400, "That upload did not complete. Try the photo again.")
    .regex(/^[0-9a-zA-Z._/-]+$/, "That upload did not complete. Try the photo again.")
    // No traversal: a path may only ever point inside the uploader's folder.
    .refine(
      (path) => !path.split("/").includes(".."),
      "That upload did not complete. Try the photo again.",
    ),
  position: z.preprocess(
    emptyToUndefined,
    z.number().int().min(0).max(MAX_PHOTOS - 1).optional(),
  ),
});

/**
 * Attaching an uploaded walkthrough to a listing.
 *
 * The same path rules as a photo, plus a poster and a duration. The path is
 * validated for traversal here AND by a check constraint on listing_videos,
 * because a row naming somebody else's object would serve that object under
 * this listing's name and the storage policy alone does not prevent the ROW.
 */
export const addVideoSchema = z.object({
  listingId: uuid("We could not identify that listing."),
  /** `<auth uid>/<listing id>/<uuid>.<ext>` inside the listing-videos bucket. */
  storagePath: z
    .string()
    .trim()
    .min(6, "That upload did not complete. Try the video again.")
    .max(400, "That upload did not complete. Try the video again.")
    .regex(/^[0-9a-zA-Z._/-]+$/, "That upload did not complete. Try the video again.")
    .refine(
      (path) => !path.split("/").includes(".."),
      "That upload did not complete. Try the video again.",
    ),
  /** The still shown before play. Lives in the public photo bucket. */
  posterPath: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(400)
      .regex(/^[0-9a-zA-Z._/-]+$/)
      .refine((path) => !path.split("/").includes(".."))
      .optional(),
  ),
  durationSeconds: optionalCount(
    1,
    MAX_VIDEO_SECONDS,
    `A video can be up to ${MAX_VIDEO_SECONDS} seconds long.`,
  ),
});

export const removeVideoSchema = z.object({
  listingId: uuid("We could not identify that listing."),
  videoId: uuid("We could not identify that video."),
});

export const removePhotoSchema = z.object({
  listingId: uuid("We could not identify that listing."),
  photoId: uuid("We could not identify that photo."),
});

export const reorderPhotosSchema = z.object({
  listingId: uuid("We could not identify that listing."),
  orderedIds: z
    .array(uuid("We could not identify that photo."))
    .min(1, "There are no photos to reorder.")
    .max(MAX_PHOTOS, `A listing holds up to ${MAX_PHOTOS} photos.`),
});

/** The whole row of a listing's photos and videos, in the order to keep. */
export const reorderMediaSchema = z.object({
  listingId: uuid("We could not identify that listing."),
  items: z
    .array(
      z.object({
        kind: z.enum(["photo", "video"]),
        id: uuid("We could not identify that photo or video."),
      }),
    )
    .min(1, "There is nothing to reorder.")
    .max(MAX_MEDIA, "A listing holds fewer items than that.")
    .refine((items) => items[0]?.kind === "photo", "The first item is the cover, and a cover has to be a photo."),
});

export const setAmenitiesSchema = z.object({
  listingId: uuid("We could not identify that listing."),
  codes: z
    .array(z.string().trim())
    .max(AMENITY_CHOICES.length, "Choose from the amenities listed.")
    .transform((codes) => Array.from(new Set(codes)))
    .refine(
      (codes) => codes.every((code) => AMENITY_CODE_SET.has(code)),
      "Choose from the amenities listed.",
    ),
});

export const listingIdSchema = z.object({
  listingId: uuid("We could not identify that listing."),
});

/**
 * What a host tells us about getting in.
 *
 * This never reaches `public.listings`, which the whole internet can read once a
 * listing is PUBLISHED. It goes to `public.listing_access`, whose select policy
 * names three readers and no others: the host, an admin, and a guest holding a
 * CONFIRMED booking on that listing.
 */
export const listingAccessSchema = z.object({
  listingId: uuid("We could not identify that listing."),
  estateName: optionalText(MAX_ESTATE_NAME, `Keep the estate name under ${MAX_ESTATE_NAME} characters.`),
  gateDirections: optionalText(
    MAX_GATE_DIRECTIONS,
    `Keep the gate directions under ${MAX_GATE_DIRECTIONS} characters.`,
  ),
  securityPhone: optionalText(
    MAX_SECURITY_PHONE,
    "That phone number is too long. A single number is enough.",
  ),
  accessCode: optionalText(MAX_ACCESS_CODE, `Keep the code under ${MAX_ACCESS_CODE} characters.`),
});

export type ListingAccessInput = z.input<typeof listingAccessSchema>;

/* ------------------------------------------------------- the submit gate */
