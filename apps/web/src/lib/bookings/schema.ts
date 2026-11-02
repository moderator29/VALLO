import { z } from "zod";

/**
 * Booking input schemas.
 *
 * Everything a guest submits to the bookings loop is validated here, on the
 * server, before any database work happens. Dates travel as ISO `YYYY-MM-DD`
 * strings end to end, which keeps timezone drift out of the maths: a night is
 * a calendar date in Lagos, not a moment in time.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date in Lagos as an ISO string, comparable with `<`. */
export function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

/** True when the string is a real calendar date, not just date-shaped. */
function isRealDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** Whole nights between two ISO dates, computed in UTC so DST cannot bite. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** The longest stay the platform accepts, in nights. */
export const MAX_STAY_NIGHTS = 365;

/**
 * Re-exported so existing importers do not move, but the rule now lives in
 * `lib/phone.ts` with the carrier ranges and the input mask beside it.
 *
 * It had to move because there were two of it. This one required the national
 * number to begin 7, 8 or 9; `lib/agent/application.ts` carried
 * `/^(\+?234|0)\d{10}$/`, which accepts `01234567890`. The same number was
 * therefore valid on one screen of the platform and refused on another, and
 * the agent side was the loose one, which is the wrong way round.
 */
import { normalisePhone } from "../phone";

export { normalisePhone };

const isoDate = (label: string) =>
  z
    .string({ message: `Pick a ${label} date.` })
    .regex(ISO_DATE_RE, `Pick a ${label} date.`)
    .refine(isRealDate, `That ${label} date does not exist. Pick it again.`);

export const reserveInputSchema = z
  .object({
    listingId: z.string().min(1, "This listing could not be identified."),
    checkIn: isoDate("check-in"),
    checkOut: isoDate("check-out"),
    adults: z.coerce
      .number({ message: "Choose how many adults are coming." })
      .int("Adults must be a whole number.")
      .min(1, "At least one adult must be on the booking.")
      .max(16, "Bookings take up to 16 adults."),
    children: z.coerce
      .number({ message: "Choose how many children are coming." })
      .int("Children must be a whole number.")
      .min(0, "Children cannot be negative.")
      .max(10, "Bookings take up to 10 children."),
    /* The person actually arriving, when that is not the person paying. All
       three are absent unless the guest turned the toggle on, so an empty
       string here means the field was shown and left blank, which the refine
       below treats as the omission it is. */
    guestName: z.string().max(80, "Use up to 80 characters for their name.").optional(),
    guestPhone: z.string().max(32, "That number is too long to be a phone number.").optional(),
    guestEmail: z.string().max(160, "Use up to 160 characters for their email address.").optional(),
  })
  .superRefine((value, ctx) => {
    if (!isRealDate(value.checkIn) || !isRealDate(value.checkOut)) return;
    if (value.checkIn < lagosToday()) {
      ctx.addIssue({
        code: "custom",
        path: ["checkIn"],
        message: "Check-in cannot be in the past. Pick today or later.",
      });
      return;
    }
    const nights = nightsBetween(value.checkIn, value.checkOut);
    if (nights < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "Check-out must be after check-in.",
      });
      return;
    }
    if (nights > MAX_STAY_NIGHTS) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "Stays can be up to 365 nights. Shorten the dates.",
      });
    }
  })
  .superRefine((value, ctx) => {
    /* Naming somebody means giving a way to reach them. A name with no number
       is worse than no name at all: it tells the security desk who to expect
       and leaves the host no way to check. The same rule is a check constraint
       on the table, so this is the courteous half of a guarantee the database
       keeps regardless. */
    const name = (value.guestName ?? "").trim();
    const phone = (value.guestPhone ?? "").trim();
    const email = (value.guestEmail ?? "").trim();
    if (name.length === 0 && phone.length === 0 && email.length === 0) return;

    if (name.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["guestName"],
        message: "Give the name of the person arriving, as it appears on their ID.",
      });
    }
    if (phone.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["guestPhone"],
        message: "Add a phone number the estate gate can ring on arrival.",
      });
    } else if (normalisePhone(phone) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["guestPhone"],
        message: "That does not look like a mobile number. Check the digits and the country beside them.",
      });
    }
    if (email.length > 0 && !/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({
        code: "custom",
        path: ["guestEmail"],
        message: "That email address does not look right. Check it, or leave it blank.",
      });
    }
  });

export type ReserveInput = z.infer<typeof reserveInputSchema>;

export const cancelInputSchema = z.object({
  bookingId: z.uuid("This booking could not be identified."),
});

export type CancelInput = z.infer<typeof cancelInputSchema>;
