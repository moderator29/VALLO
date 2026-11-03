import { describe, expect, it } from "vitest";
import { asksFact, submitRequirements, type SubmitSubject } from "./listings-model";

const base: SubmitSubject = {
  title: "A good place to list here",
  description: Array.from({ length: 60 }, (_, i) => `word${i}`).join(" "),
  propertyType: "land",
  stateCode: "LA",
  city: "Lagos",
  area: "Lekki",
  intent: "sale",
  rentMinor: null,
  rentPeriod: null,
  rateMinor: null,
  ratePeriod: null,
  salePriceMinor: 50_000_000_00,
  tenure: "c_of_o" as SubmitSubject["tenure"],
  bedrooms: 0,
  bathrooms: 0,
  amenityCount: 0,
  photoCount: 6,
  hasCover: true,
};

describe("each property type is asked only its own facts", () => {
  it("a plot is asked no rooms, furnishing, floor, amenities, light or water", () => {
    for (const fact of ["bedrooms", "bathrooms", "toilets", "parking", "furnishing", "floor", "condition", "amenities", "power", "water", "compound"] as const) {
      expect(asksFact("land", fact)).toBe(false);
    }
  });

  it("a shop and an office have no bedrooms, bathrooms or compound of homes; an office may be furnished", () => {
    expect(asksFact("shop", "bedrooms")).toBe(false);
    expect(asksFact("shop", "bathrooms")).toBe(false);
    expect(asksFact("shop", "compound")).toBe(false);
    expect(asksFact("shop", "toilets")).toBe(true);
    expect(asksFact("shop", "furnishing")).toBe(false);
    expect(asksFact("office", "furnishing")).toBe(true);
  });

  it("homes are asked everything", () => {
    for (const type of ["apartment", "shortlet", "home", "villa", "rental"] as const) {
      expect(asksFact(type, "bedrooms")).toBe(true);
      expect(asksFact(type, "amenities")).toBe(true);
    }
  });

  it("the gate does not demand amenities or a bathroom of a plot", () => {
    const fields = submitRequirements(base).map((r) => r.field);
    expect(fields).not.toContain("amenities");
    expect(fields).not.toContain("bathrooms");
    expect(fields).toEqual([]);
  });

  it("the gate still demands them of a home", () => {
    const fields = submitRequirements({ ...base, propertyType: "home" }).map((r) => r.field);
    expect(fields).toContain("amenities");
    expect(fields).toContain("bathrooms");
  });
});
