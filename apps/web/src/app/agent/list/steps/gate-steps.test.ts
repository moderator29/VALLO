import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROPERTY_TYPE_VALUES, submitRequirements, type PropertyType } from "@/lib/agent/listings-model";
import { takesShape } from "@/lib/listings/unit-shape";
import { STEP_DEFS, kindOf, stepOfSaveRefusal, stepsFor, type ListingKind } from "./model";

/**
 * EVERY THING THE SEND GATE CAN ASK FOR IS ASKED ON A SCREEN THIS LISTING IS
 * SHOWN (22 November 2026, the sweep after the agent sign-up NIN).
 *
 * The bug that stopped agents this morning was a Continue waiting for a box
 * on another screen. The listing wizard's version of it would be a send gate
 * (`submitRequirements`, which `submitListing` runs on the server too) naming
 * a field that no step of THIS listing's flow draws: the check page would list
 * a "Fix" with nowhere to land, and the listing could never be sent.
 *
 * So for every kind and every property type the wizard can hold, an empty
 * listing's every unmet requirement must be OWNED (by name, not by the
 * fallback) by a step that is in that listing's own flow, and that step's
 * component must draw the field for that kind and type.
 */

const KINDS: ListingKind[] = ["stay", "rent", "sale"];

function subjectFor(kind: ListingKind, propertyType: PropertyType) {
  return {
    title: "",
    description: "",
    propertyType,
    stateCode: "",
    city: "",
    area: "",
    intent: kind === "sale" ? ("sale" as const) : ("rent" as const),
    rentMinor: null,
    rentPeriod: null,
    rateMinor: null,
    ratePeriod: null,
    salePriceMinor: null,
    tenure: null,
    bedrooms: -1,
    bathrooms: 0,
    unitShape: null,
    amenityCount: 0,
    photoCount: 0,
    videoCount: 0,
    hasCover: false,
    moveInStatedMinor: 2,
    moveInPartsMinor: [1],
  };
}

/* Each combination the wizard can actually be in: the kind is read from the
   intent and the type, so a pair that reads as another kind is that kind. */
const CASES = KINDS.flatMap((kind) =>
  PROPERTY_TYPE_VALUES.map((propertyType) => ({ kind, propertyType })),
).filter(({ kind, propertyType }) => kindOf({ intent: kind === "sale" ? "sale" : "rent", propertyType }) === kind);

/* `ratePeriod` is never asked on screen: the wizard derives it from the
   category on every save (`ratePeriodFor`), so the gate can never hold it. */
const DERIVED = new Set(["ratePeriod"]);

describe("the send gate asks only for what this listing's own flow draws", () => {
  it.each(CASES)("$kind / $propertyType", ({ kind, propertyType }) => {
    const steps = stepsFor({ kind, propertyType });
    const unmet = submitRequirements(subjectFor(kind, propertyType)).filter((item) => !DERIVED.has(item.field));
    expect(unmet.length).toBeGreaterThan(0);
    for (const item of unmet) {
      const owner = steps.find((step) => step.owns.includes(item.field));
      expect(owner, `${kind}/${propertyType}: nothing in this flow owns "${item.field}"`).toBeDefined();
      expect(owner?.id).not.toBe("check");
    }
  });
});

const step = (name: string) => readFileSync(join(__dirname, name), "utf8");

describe("the owning step draws the field for the listings that are asked it", () => {
  it("the place step draws the unit shape on exactly the rule the gate uses", () => {
    expect(step("PlaceStep.tsx")).toContain("takesShape(values.propertyType) ?");
    const place = STEP_DEFS.find((s) => s.id === "place")!;
    for (const propertyType of PROPERTY_TYPE_VALUES) {
      if (takesShape(propertyType)) expect(place.applies({ kind: "rent", propertyType }), propertyType).toBe(true);
    }
  });

  it("the terms step draws the title deed for a sale", () => {
    const source = step("TermsStep.tsx");
    const sale = source.indexOf("if (money.forSale)");
    expect(sale).toBeGreaterThan(0);
    expect(source.indexOf('set("tenure"', sale)).toBeGreaterThan(sale);
  });

  it("the rooms step draws the bathrooms on the same fact the gate asks", () => {
    expect(step("RoomsStep.tsx")).toContain('asks("bathrooms") ?');
  });

  it("the price step has a branch for each of the three markets", () => {
    const source = step("PriceStep.tsx");
    expect(source).toContain("if (money.forSale)");
    expect(source).toContain("if (money.tenancy)");
    for (const key of ['"salePriceNaira"', '"rentNaira"', '"rateNaira"', '"rentPeriod"']) expect(source).toContain(key);
  });

  it("the location step draws the state, the city and the area", () => {
    const source = step("LocationStep.tsx");
    for (const key of ['"stateCode"', '"city"', '"area"']) expect(source).toContain(key);
  });
});

describe("a refused save lands on the step that owns the refused box", () => {
  const flat = stepsFor({ kind: "rent", propertyType: "rental" });

  it("stays when the screen on show owns the box, or nothing was named", () => {
    expect(stepOfSaveRefusal(["totalMoveInNaira"], flat, "charges")).toBeNull();
    expect(stepOfSaveRefusal([], flat, "kind")).toBeNull();
    expect(stepOfSaveRefusal(["somethingNobodyOwns"], flat, "kind")).toBeNull();
  });

  it("goes to the box a broadcast filled on the first screen", () => {
    expect(stepOfSaveRefusal(["totalMoveInNaira"], flat, "kind")).toBe("charges");
    expect(stepOfSaveRefusal(["bedrooms"], flat, "kind")).toBe("rooms");
    expect(stepOfSaveRefusal(["rentNaira", "totalMoveInNaira"], flat, "kind")).toBe("price");
  });

  it("goes back to an earlier box, never to the check page", () => {
    expect(stepOfSaveRefusal(["floor"], flat, "charges")).toBe("place");
    expect(stepOfSaveRefusal(["securityPhone"], flat, "check")).toBe("access");
  });

  it("every key the draft save can refuse has a step that owns it", () => {
    const owned = new Set(STEP_DEFS.flatMap((s) => s.owns));
    const source = readFileSync(join(__dirname, "../../../../lib/agent/listings-schema.ts"), "utf8");
    const block = source.slice(source.indexOf("export const draftInputSchema"), source.indexOf("}).superRefine"));
    const keys = [...block.matchAll(/^  ([a-zA-Z]+):/gm)].map((m) => m[1]!);
    const exempt = new Set(["id", "intent", "propertyType", "broadcastUnconfirmed", "ratePeriod"]);
    expect(keys.length).toBeGreaterThan(40);
    for (const key of keys) {
      if (exempt.has(key)) continue;
      expect(owned.has(key), `the save can refuse "${key}" but no step owns it`).toBe(true);
    }
  });
});
