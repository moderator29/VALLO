import { z } from "zod";
import type { Dictionary } from "@vallo/i18n/core";
import { STAY_FACILITY_CODES } from "./facilities";
import { normalisePhone } from "../phone";
import { CAC_NUMBER_RE, CONSENTS, HOST_DOCUMENT_KINDS, HOST_TYPES } from "./onboarding";

/**
 * Host onboarding input schemas.
 *
 * Every field is optional on the draft schema and that is deliberate: the
 * wizard saves after every step, so a save must never refuse a half-filled
 * application. What each field must LOOK LIKE when present is checked here,
 * once, with the same rules the database's own CHECKs carry, so a person is
 * told about a malformed CAC number beside the box rather than by a refusal
 * after ten more minutes of typing. What must be PRESENT to submit is
 * `missingFrom`'s job, not this file's.
 *
 * THE WORDS ARE THE HOST'S (C9). Each schema is built from the messages in
 * `experienceHost.refusals.schema`, which the server action reads in the
 * request's locale (`hostRefusals()`), so a Hausa, Yoruba or Igbo host reads
 * the sentence beside the box in their own language. Built per call: zod
 * bakes a custom message into the schema, and a request is one locale.
 */

/** The field messages, from the reader's dictionary (`experienceHost.refusals.schema`). */
export type SchemaWords = Dictionary["experienceHost"]["refusals"]["schema"];

/** A time field's sentence, with the example clock time that field carries. */
const timeLike = (w: SchemaWords, time: string) => w.timeLike.replace("{time}", time);

const trimmed = (max: number) => z.string().trim().max(max);

/** A Nigerian phone in any of the six forms people write it, or nothing. */
const phone = (w: SchemaWords) => z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) return "";
    const normalised = normalisePhone(value);
    if (normalised === null) {
      ctx.addIssue({
        code: "custom",
        message: w.phoneBad,
      });
      return z.NEVER;
    }
    return normalised;
  });

export const hostDraftSchema = (w: SchemaWords) => z.object({
  hostType: z.enum(HOST_TYPES).optional(),
  kind: z.string().trim().min(1).optional(),
  name: trimmed(120).optional(),
  description: trimmed(4000).optional(),
  phone: phone(w).optional(),
  email: z
    .string()
    .trim()
    .max(160)
    .refine(
      (value) => value.length === 0 || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
      w.emailBad,
    )
    .optional(),
  address: trimmed(300).optional(),
  area: trimmed(120).optional(),
  city: trimmed(120).optional(),
  stateCode: trimmed(10).optional(),
  registeredName: trimmed(160).optional(),
  cacNumber: z
    .string()
    .trim()
    .max(20)
    .refine(
      (value) => value.length === 0 || CAC_NUMBER_RE.test(value),
      w.cacBad,
    )
    .optional(),
  tin: z
    .string()
    .trim()
    .max(20)
    .refine(
      (value) => value.length === 0 || /^[0-9-]{8,20}$/.test(value),
      w.tinBad,
    )
    .optional(),
  representativeName: trimmed(120).optional(),
  representativePhone: phone(w).optional(),
  /** The consents ticked on this save. Each becomes its own timestamp. */
  consents: z.array(z.enum(CONSENTS.map((consent) => consent.id))).optional(),
  /**
   * The consents unticked on this save. Each is removed and its withdrawal
   * recorded with the moment, so the application cannot be sent until it is
   * given again.
   */
  withdrawConsents: z.array(z.enum(CONSENTS.map((consent) => consent.id))).optional(),
  /**
   * The host agreeing, on this save, to the Terms, the Privacy policy and the
   * Host Agreement. Recorded with the moment and each version; required on
   * the save that creates the business.
   */
  agreeToHostTerms: z.literal(true).optional(),
  /**
   * Ruling 6 (13 October 2026): "Every payment for a deal I make on Vallo
   * happens inside Vallo.", recorded with its version and the moment beside
   * the Host Agreement. Required before the application is sent.
   */
  agreeToPayOnVallo: z.literal(true).optional(),
  /** The two attestations, each stamped with the moment it was made. */
  hygieneAttested: z.boolean().optional(),
  licenceAttested: z.boolean().optional(),
});

export type HostDraftInput = z.infer<ReturnType<typeof hostDraftSchema>>;

export const hostDocumentSchema = (w: SchemaWords) => z.object({
  businessId: z.uuid(w.applicationUnknown),
  kind: z.enum(HOST_DOCUMENT_KINDS, { message: w.documentKind }),
  storagePath: z
    .string()
    .trim()
    .min(1, w.uploadUnknown)
    .max(400, w.uploadUnknown),
});

export const accommodationDraftSchema = (w: SchemaWords) => z.object({
  name: z.string().trim().min(2, w.propertyName).max(120),
  description: trimmed(6000).optional(),
  starRating: z.number().int().min(1).max(5).nullable().optional(),
  checkInFrom: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, timeLike(w, "14:00"))
    .optional(),
  checkOutBy: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, timeLike(w, "11:00"))
    .optional(),
  houseRules: trimmed(4000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  cancellationPolicyId: z.uuid().optional(),
});

export const roomTypeDraftSchema = (w: SchemaWords) => z.object({
  accommodationId: z.uuid(w.propertyUnknown),
  name: z.string().trim().min(2, w.roomTypeName).max(80),
  category: z.enum(["single", "double", "twin", "suite", "family", "dorm"], {
    message: w.roomCategory,
  }),
  description: trimmed(2000).optional(),
  sleeps: z.number().int().min(1, w.roomSleepsOne).max(20),
  unitsTotal: z.number().int().min(1, w.unitsOne),
  /** Integer kobo. The naira boundary is the form's, never this schema's. */
  baseRateMinor: z.number().int().min(0, w.rateNegative),
  sizeSqm: z.number().positive().nullable().optional(),
});

export const ratePlanDraftSchema = (w: SchemaWords) => z.object({
  roomTypeId: z.uuid(w.roomTypeUnknown),
  name: z.string().trim().min(2, w.rateName).max(80),
  mealPlan: z.enum(["room_only", "breakfast", "half_board", "full_board"]).optional(),
  cancellationPolicyId: z.uuid(w.policy),
  rateMinor: z.number().int().min(0, w.rateNegative),
  minStayNights: z.number().int().min(1).optional(),
  maxStayNights: z.number().int().min(1).nullable().optional(),
});

export const serviceWindowDraftSchema = (w: SchemaWords) => z
  .object({
    weekday: z.number().int().min(0).max(6),
    opens: z.string().trim().regex(/^\d{2}:\d{2}$/, timeLike(w, "12:00")),
    lastSeating: z.string().trim().regex(/^\d{2}:\d{2}$/, timeLike(w, "21:30")),
    closes: z.string().trim().regex(/^\d{2}:\d{2}$/, timeLike(w, "22:00")),
    covers: z.number().int().min(1, w.coversSay).max(2000),
  })
  .refine((value) => value.opens < value.closes, {
    message: w.closesAfterOpens,
    path: ["closes"],
  })
  .refine((value) => value.lastSeating >= value.opens && value.lastSeating <= value.closes, {
    message: w.lastSeatingInside,
    path: ["lastSeating"],
  });

export const restaurantProfileDraftSchema = (w: SchemaWords) => z.object({
  cuisines: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  priceBand: z.number().int().min(1).max(4).nullable().optional(),
  menuUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value.length === 0 || value.startsWith("https://"),
      w.menuHttps,
    )
    .optional(),
  dressCode: trimmed(120).optional(),
  parking: z.boolean().optional(),
  powerBackup: z.boolean().optional(),
  outdoor: z.boolean().optional(),
  /* The restaurant's own table rules, the values the CHECKs in
     `20261013090200_...` accept. */
  sittingMinutes: z.union([z.literal(60), z.literal(90), z.literal(120), z.literal(180)]).optional(),
  holdMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]).optional(),
  cancelNoticeHours: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(24)]).optional(),
});

/* ---------------------------------------------------------- photographs */

/**
 * One photograph of the venue, already uploaded to the public bucket.
 *
 * The same shape as `hostDocumentSchema` above and for the same reason: the
 * browser puts the object in storage under its own uid prefix, which storage
 * RLS enforces, and hands the server the path. The server trusts none of it.
 */
export const businessPhotoSchema = (w: SchemaWords) => z.object({
  businessId: z.uuid(w.venueUnknown),
  storagePath: z
    .string()
    .trim()
    .min(1, w.uploadUnknown)
    .max(400, w.uploadUnknown),
});

/** One photograph already on record, named for removal. */
export const businessPhotoIdSchema = (w: SchemaWords) => z.object({
  photoId: z.uuid(w.photoUnknown),
});

/**
 * One photograph of an accommodation, already uploaded to the public bucket.
 *
 * The accommodation twin of `businessPhotoSchema`, same shape and same
 * reasoning. The two spines are separate tables with separate owner helpers
 * (`private.owns_accommodation` against `private.owns_business`), so they are
 * separate schemas rather than one with an optional key: a call that named
 * neither, or both, would have to be refused at runtime by an action instead
 * of at the boundary by a type.
 */
export const accommodationPhotoSchema = (w: SchemaWords) => z.object({
  accommodationId: z.uuid(w.propertyUnknown),
  storagePath: z
    .string()
    .trim()
    .min(1, w.uploadUnknown)
    .max(400, w.uploadUnknown),
});

/**
 * A photograph of one ROOM TYPE the browser has already put in the bucket
 * (`room_type_photos`). The same shape as a property's, one level down.
 */
export const roomTypePhotoSchema = (w: SchemaWords) => z.object({
  roomTypeId: z.uuid(w.roomTypeUnknown),
  storagePath: z
    .string()
    .trim()
    .min(1, w.uploadUnknown)
    .max(400, w.uploadUnknown),
});

/** One accommodation photograph already on record, named for removal. */
export const accommodationPhotoIdSchema = (w: SchemaWords) => z.object({
  photoId: z.uuid(w.photoUnknown),
});

/* ------------------------------------------------------------- facilities */

/**
 * What a stay offers, as exactly the codes the facilities surface knows.
 *
 * The whitelist is here rather than a regex, because `accommodation_amenities`
 * joins `amenities` by id and a code the table does not carry would be dropped
 * silently on the way through: a host would tick a box, see nothing refused
 * and have nothing saved. Anything not on the list is refused in words.
 */
export const accommodationFacilitiesSchema = (w: SchemaWords) => z.object({
  accommodationId: z.uuid(w.propertyUnknown),
  codes: z
    .array(
      z.string().refine((code) => STAY_FACILITY_CODES.includes(code), {
        message: w.facilityUnknown,
      }),
    )
    .max(STAY_FACILITY_CODES.length, w.facilitiesTooMany),
});

/* ------------------------------------------------------- nightly inventory */

/** A date the way `room_inventory.date` stores it, and nothing looser. */
const isoDay = (w: SchemaWords) => z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, w.notADate);

/**
 * How many of a room type are on sale across a run of nights.
 *
 * `unitsOpen` of zero is a closure rather than a missing value, which is why
 * it is a number with a floor of zero and never an optional. The ceiling is
 * checked by the database against the room type's own `units_total`, because
 * only the database knows that number at the moment of the write; 500 here is
 * a sanity bound on what a form may post, not a product rule.
 */
export const roomNightsSchema = (w: SchemaWords) => z
  .object({
    roomTypeId: z.uuid(w.roomTypeUnknown),
    from: isoDay(w),
    to: isoDay(w),
    unitsOpen: z
      .number()
      .int(w.wholeRooms)
      .min(0, w.fewerThanNone)
      .max(500, w.roomsTooMany),
  })
  .refine((value) => value.to >= value.from, {
    message: w.lastBeforeFirst,
    path: ["to"],
  });

/* --------------------------------------------------- the drawn stays set-up */

/**
 * THE SHORTLET'S PLACE, as `GOVERNING-11` screen one asks for it.
 *
 * ONE ROOM TYPE, NOT A LIST OF THEM. A shortlet operator lets a place, and the
 * place is the bookable unit: `room_types` holds it with `sleeps` as the
 * maximum guests and `units_total` as how many identical ones they let. The
 * hotel branch keeps its list of room types untouched; this is the shortlet's
 * own shape and it exists because a form that asked "how many of this room do
 * you have" about somebody's flat was the wrong question asked eight times.
 *
 * `placeType` IS A `room_category` THAT NOW EXISTS. The three values were
 * added additively by `20260922190000_imgc_a_shortlet_is_not_a_hotel_room.sql`
 * and the coordinator has applied it: the live enum reads
 * `entire_flat, whole_house, private_room, single, double, twin, suite,
 * family, dorm`. The enum is not restated as a zod enum of the old six: it is
 * exactly the three the render draws, so a refusal on an estate where the
 * migration has NOT run is a refusal from Postgres with a code the action can
 * read and explain, rather than this file quietly writing "double" for a whole
 * house.
 */
export const shortletPlaceDraftSchema = (w: SchemaWords) => z.object({
  accommodationId: z.uuid(w.propertyUnknown),
  placeType: z.enum(["entire_flat", "whole_house", "private_room"], {
    message: w.placeType,
  }),
  name: z.string().trim().min(2, w.placeName).max(80),
  /*
   * THE CEILING IS THE COLUMN'S. `room_types_bedrooms_check` refuses anything
   * outside 0 to 30, so a form that accepted 31 would be a form whose refusal
   * arrived from Postgres as a constraint violation instead of from here as a
   * sentence. Zero is accepted on purpose: a studio has no separate bedroom
   * and refusing zero would make a studio unlistable.
   */
  bedrooms: z.number().int().min(0, w.fewerThanNone).max(30),
  /*
   * A COUNT HERE, AN ARRAY IN THE COLUMN. `room_types.beds` is a jsonb ARRAY
   * of `{kind, count}` enforced by `room_types_beds_check`, and
   * `GOVERNING-11` screen one asks only for a total. `bedsArray` in
   * `stays-setup.ts` does the one conversion, at the one boundary.
   */
  beds: z.number().int().min(1, w.bedOne).max(60),
  maxGuests: z.number().int().min(1, w.placeSleepsOne).max(40),
  /** Integer kobo. The naira boundary is the form's, never this schema's. */
  nightlyRateMinor: z.number().int().min(0, w.rateNegative),
});

/**
 * THE WEEK, as `GOVERNING-11` screen four sets it: seven switches and one
 * pair of times a day.
 *
 * REPLACES THE SET RATHER THAN ADDING TO IT, which is the whole reason it is
 * not seven calls to `addServiceWindowDraft`. Turning Sunday off has to DELETE
 * Sunday's window, and an add-only action can only ever grow the week; a
 * restaurant that opened on Sunday once could never close again.
 */
export const openingHoursDraftSchema = (w: SchemaWords) => z.object({
  days: z
    .array(
      z
        .object({
          weekday: z.number().int().min(0).max(6),
          opens: z.string().trim().regex(/^\d{2}:\d{2}$/, timeLike(w, "08:00")),
          closes: z.string().trim().regex(/^\d{2}:\d{2}$/, timeLike(w, "23:00")),
        })
        .refine((value) => value.opens < value.closes, {
          message: w.closesAfterOpens,
          path: ["closes"],
        }),
    )
    .max(7, w.sevenDays),
  /**
   * How many people the room seats, which is what the table steppers add up
   * to. The same number goes on every open day, because this platform has
   * never asked a restaurant whether Tuesday seats fewer people than Friday
   * and inventing a per-day figure would be inventing a number.
   */
  covers: z
    .number()
    .int(w.wholeSeats)
    .min(1, w.coversSay)
    .max(2000, w.seatsTooMany),
});
