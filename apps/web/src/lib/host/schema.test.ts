import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";

import {
  hostDraftSchema,
  openingHoursDraftSchema,
  roomNightsSchema,
  serviceWindowDraftSchema,
  shortletPlaceDraftSchema,
  type SchemaWords,
} from "./schema";

/**
 * THE WIZARD'S FIELD MESSAGES COME FROM THE HOST'S DICTIONARY (C9).
 *
 * The schemas once carried their English in the module. They are built per
 * request now, from `experienceHost.refusals.schema` in the request's locale.
 * These pin the English byte for byte, as the module spelled it, and prove
 * the words a schema says are the words it was built from.
 */
const EN = getDictionary("en").experienceHost.refusals.schema;
const UUID = "00000000-0000-4000-8000-000000000001";

function messages(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]));
}

describe("the host wizard's field messages", () => {
  it("say in English exactly what the schema module used to say", () => {
    expect(messages(hostDraftSchema(EN).safeParse({ phone: "12", email: "nope", cacNumber: "x", tin: "ab" }))).toEqual({
      phone: "That does not look like a mobile number. Check the digits and the country.",
      email: "Enter an email address we can actually write to.",
      cacNumber: "That is not an RC or BN number. It is the one on your CAC certificate, like RC 1234567.",
      tin: "A TIN is digits, with or without dashes.",
    });
    expect(
      messages(serviceWindowDraftSchema(EN).safeParse({ weekday: 1, opens: "noon", lastSeating: "21:30", closes: "22:00", covers: 0 })),
    ).toEqual({
      opens: "Use a time like 12:00.",
      covers: "Say how many people you can seat.",
      closes: "A service closes after it opens.",
      lastSeating: "The last seating falls inside the service.",
    });
    expect(
      messages(openingHoursDraftSchema(EN).safeParse({ days: [{ weekday: 1, opens: "09:00", closes: "08:00" }], covers: 1.5 })),
    ).toEqual({ "days.0.closes": "A service closes after it opens.", covers: "Seats come in whole numbers." });
    expect(
      messages(roomNightsSchema(EN).safeParse({ roomTypeId: UUID, from: "2026-10-09", to: "2026-10-08", unitsOpen: 1 })),
    ).toEqual({ to: "The last night cannot come before the first." });
    expect(
      messages(
        shortletPlaceDraftSchema(EN).safeParse({ accommodationId: "x", placeType: "boat", name: "A", bedrooms: -1, beds: 0, maxGuests: 0, nightlyRateMinor: -1 }),
      ),
    ).toEqual({
      accommodationId: "That property could not be identified.",
      placeType: "Pick what kind of place this is.",
      name: "Give the place a name.",
      bedrooms: "That cannot be fewer than none.",
      beds: "A place has at least one bed.",
      maxGuests: "A place sleeps at least one.",
      nightlyRateMinor: "A rate cannot be negative.",
    });
  });

  it("say what the dictionary they were built from says, so another locale's words reach the host", () => {
    const marked = Object.fromEntries(Object.entries(EN).map(([key, line]) => [key, `[ha] ${line}`])) as SchemaWords;
    expect(messages(hostDraftSchema(marked).safeParse({ tin: "ab" })).tin).toBe("[ha] A TIN is digits, with or without dashes.");
    expect(messages(serviceWindowDraftSchema(marked).safeParse({ weekday: 1, opens: "x", lastSeating: "21:30", closes: "22:00", covers: 4 })).opens).toBe(
      "[ha] Use a time like 12:00.",
    );
  });
});
