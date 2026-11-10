import { describe, expect, it } from "vitest";
import {
  adultBirthDateSchema,
  birthYearOptions,
  earliestBirthDate,
  isAdultBirthDate,
  latestAdultBirthDate,
  parseBirthDate,
} from "./adult";

const NOW = new Date("2026-11-10T12:00:00Z");

describe("the 18 and over rule", () => {
  it("makes the latest allowed date exactly eighteen years back", () => {
    expect(latestAdultBirthDate(NOW)).toBe("2008-11-10");
  });
  it("accepts the 18th birthday itself and refuses the day after", () => {
    expect(isAdultBirthDate("2008-11-10", NOW)).toBe(true);
    expect(isAdultBirthDate("2008-11-11", NOW)).toBe(false);
  });
  it("refuses future, under-18, malformed and impossible dates", () => {
    for (const bad of ["2027-01-01", "2015-05-05", "2008-02-30", "not a date", "", null, 12, "1800-01-01"]) {
      expect(isAdultBirthDate(bad, NOW)).toBe(false);
    }
  });
  it("clamps 29 February to 28 February eighteen years on", () => {
    expect(latestAdultBirthDate(new Date("2028-02-29T12:00:00Z"))).toBe("2010-02-28");
  });
  it("reads Lagos days, not UTC days", () => {
    /* 23:30 UTC on 9 Nov is already 10 Nov in Lagos. */
    expect(latestAdultBirthDate(new Date("2026-11-09T23:30:00Z"))).toBe("2008-11-10");
  });
  it("starts the year picker at the latest adult year and runs back", () => {
    const years = birthYearOptions(NOW, 100);
    expect(years[0]).toBe(2008);
    expect(years[1]).toBe(2007);
    expect(years.at(-1)).toBe(1908);
    expect(years.every((y) => y <= 2008)).toBe(true);
    expect(earliestBirthDate(NOW)).toBe("1916-01-01");
  });
  it("parses only real calendar days", () => {
    expect(parseBirthDate("2000-02-29")).toEqual({ year: 2000, month: 2, day: 29 });
    expect(parseBirthDate("2001-02-29")).toBeNull();
  });
  it("is enforced by the zod schema", () => {
    expect(adultBirthDateSchema.safeParse("1990-06-01").success).toBe(true);
    const young = adultBirthDateSchema.safeParse("2999-01-01");
    expect(young.success).toBe(false);
    expect(adultBirthDateSchema.safeParse("2020-01-01").success).toBe(false);
    expect(adultBirthDateSchema.safeParse("hello").success).toBe(false);
  });
});
