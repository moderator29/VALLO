import { describe, expect, it } from "vitest";
import {
  allCountries,
  callingCode,
  flagOf,
  formatInternational,
  guessCountry,
  isNigerian,
  readInternational,
} from "./phone-intl";

describe("readInternational", () => {
  it("reads a UK mobile written the way people write it at home", () => {
    const r = readInternational("07911 123456", "GB");
    expect(r).toMatchObject({ state: "valid", e164: "+447911123456" });
  });
  it("reads a number with a plus whatever country is chosen", () => {
    expect(readInternational("+44 7911 123456", "NG")).toMatchObject({ state: "valid", e164: "+447911123456" });
    expect(readInternational("+1 415 555 2671", "GB")).toMatchObject({ state: "valid", e164: "+14155552671" });
  });
  it("reads a Nigerian mobile in Nigeria", () => {
    expect(readInternational("0803 123 4567", "NG")).toMatchObject({ state: "valid", e164: "+2348031234567" });
  });
  it("reads a German and a Ghanaian mobile", () => {
    expect(readInternational("0151 23456789", "DE")).toMatchObject({ state: "valid", e164: "+4915123456789" });
    expect(readInternational("024 123 4567", "GH")).toMatchObject({ state: "valid", e164: "+233241234567" });
  });
  it("says empty, incomplete and invalid apart", () => {
    expect(readInternational("", "GB")).toEqual({ state: "empty" });
    expect(readInternational("0791", "GB")).toEqual({ state: "incomplete" });
    expect(readInternational("07911 123456789012", "GB")).toMatchObject({ state: "invalid" });
  });
  it("refuses a landline, which cannot receive a code by SMS", () => {
    expect(readInternational("020 7946 0958", "GB")).toEqual({ state: "invalid" });
  });
});

describe("helpers", () => {
  it("formats a stored number for reading back", () => {
    expect(formatInternational("+447911123456")).toBe("+44 7911 123456");
    expect(formatInternational("not a number")).toBe("not a number");
  });
  it("lists Nigeria and the United Kingdom first and every country once", () => {
    const all = allCountries();
    expect(all.slice(0, 2)).toEqual(["NG", "GB"]);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(200);
  });
  it("knows calling codes, flags, browser hints and Nigerian numbers", () => {
    expect(callingCode("GB")).toBe("44");
    expect(flagOf("NG")).toBe("\u{1F1F3}\u{1F1EC}");
    expect(guessCountry("en-GB")).toBe("GB");
    expect(guessCountry("en")).toBeNull();
    expect(isNigerian("+2348031234567")).toBe(true);
    expect(isNigerian("+447911123456")).toBe(false);
  });
});
