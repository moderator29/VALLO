import { describe, expect, it } from "vitest";
import { submitRequirements } from "@/lib/agent/listings-model";
import {
  EMPTY,
  STEP_DEFS,
  applyKind,
  kindOf,
  moneyOf,
  percentOf,
  startStep,
  stepOfGateField,
  stepsFor,
  typesFor,
  type Values,
} from "./model";
import { descriptionFromAnswers, titleFromAnswers } from "./describe";

/* The one-question flow as data (P1.1): which questions a listing is asked,
   in what order, and where a thing to fix lands. */

const ids = (values: Pick<Values, "intent" | "propertyType">) =>
  stepsFor({ kind: kindOf(values), propertyType: values.propertyType }).map((s) => s.id);

describe("the three kinds, read from the answers that already decide the market", () => {
  it("is a sale whenever the intent is sale, a let for a tenancy type, a stay otherwise", () => {
    expect(kindOf({ intent: "sale", propertyType: "rental" })).toBe("sale");
    expect(kindOf({ intent: "rent", propertyType: "rental" })).toBe("rent");
    expect(kindOf({ intent: "rent", propertyType: "land" })).toBe("rent");
    expect(kindOf({ intent: "rent", propertyType: "shortlet" })).toBe("stay");
    expect(kindOf({ intent: "rent", propertyType: "apartment" })).toBe("stay");
  });

  it("keeps a type the chosen kind allows and replaces one it cannot have", () => {
    expect(applyKind({ intent: "rent", propertyType: "shop" }, "rent")).toEqual({ intent: "rent", propertyType: "shop" });
    expect(applyKind({ intent: "rent", propertyType: "apartment" }, "rent")).toEqual({ intent: "rent", propertyType: "rental" });
    expect(applyKind({ intent: "rent", propertyType: "rental" }, "stay")).toEqual({ intent: "rent", propertyType: "shortlet" });
    expect(applyKind({ intent: "rent", propertyType: "shortlet" }, "sale")).toEqual({ intent: "sale", propertyType: "home" });
    expect(applyKind({ intent: "rent", propertyType: "villa" }, "sale")).toEqual({ intent: "sale", propertyType: "villa" });
  });

  it("offers each kind its own type tiles, and never drops the draft's own type", () => {
    expect(typesFor("rent", "rental")).toEqual(["rental", "shop", "office", "land"]);
    expect(typesFor("stay", "hotel")).toContain("hotel");
    expect(typesFor("stay", "apartment")).not.toContain("hotel");
  });
});

describe("the flow is computed from the answers (R29, pattern 11)", () => {
  it("asks a flat every question, fifteen in all, ending on the check page", () => {
    const flat = ids({ intent: "rent", propertyType: "rental" });
    expect(flat).toEqual([
      "kind",
      "type",
      "location",
      "rooms",
      "place",
      "supply",
      "compound",
      "access",
      "amenities",
      "price",
      "charges",
      "terms",
      "photos",
      "describe",
      "check",
    ]);
  });

  it("does not ask a plot about its shape, its light and water or its amenities", () => {
    const plot = ids({ intent: "sale", propertyType: "land" });
    expect(plot).not.toContain("place");
    expect(plot).not.toContain("supply");
    expect(plot).not.toContain("amenities");
    expect(plot).toHaveLength(12);
    expect(plot.at(-1)).toBe("check");
  });

  it("gives every gate field the submit gate can name a step that owns it", () => {
    const flat = stepsFor({ kind: "rent", propertyType: "rental" });
    const unmet = submitRequirements({ title: "", description: "", propertyType: "rental", intent: "rent" } as Parameters<typeof submitRequirements>[0]);
    for (const item of unmet) {
      const owner = stepOfGateField(item.field, flat);
      expect(flat.map((s) => s.id), item.field).toContain(owner);
      expect(owner, item.field).not.toBe("check");
    }
    expect(stepOfGateField("tenure", flat)).toBe("terms");
    expect(stepOfGateField("photos", flat)).toBe("photos");
    expect(stepOfGateField("title", flat)).toBe("describe");
    expect(stepOfGateField("unitShape", flat)).toBe("place");
    expect(stepOfGateField("totalMoveIn", flat)).toBe("charges");
  });

  it("owns each answer once", () => {
    const owned = STEP_DEFS.flatMap((s) => s.owns);
    expect(new Set(owned).size).toBe(owned.length);
  });

  it("opens on a step id, or on a clamped index for the older harnesses", () => {
    const flat = stepsFor({ kind: "rent", propertyType: "rental" });
    expect(startStep("photos", flat)).toBe("photos");
    expect(startStep(0, flat)).toBe("kind");
    expect(startStep(99, flat)).toBe("check");
    const plot = stepsFor({ kind: "sale", propertyType: "land" });
    expect(startStep("supply", plot)).toBe("kind");
  });
});

describe("the money the charge cards read", () => {
  it("takes a percentage of the rent in whole naira, and nothing without a rent", () => {
    expect(percentOf(180_000_000, "10")).toBe("180000");
    expect(percentOf(0, "10")).toBeNull();
  });

  it("keeps a blank fee undeclared and a typed zero declared", () => {
    const money = moneyOf({ ...EMPTY, propertyType: "rental", rentNaira: "1800000", agencyFeeNaira: "0" });
    expect(money.tenancy).toBe(true);
    expect(money.paysFacts.agencyFeeMinor).toBe(0);
    expect(money.paysFacts.legalFeeMinor).toBeUndefined();
    expect(money.partsSumMinor).toBe(180_000_000);
  });
});

describe("rewrite from my answers", () => {
  const answers: Values = {
    ...EMPTY,
    propertyType: "rental",
    intent: "rent",
    area: "Yaba",
    city: "Lagos",
    address: "12 Herbert Macaulay Way",
    landmark: "Opposite the bus stop",
    bedrooms: 2,
    bathrooms: 2,
    furnished: "fully_furnished",
    powerGrid: "BAND_A",
    waterSupply: "BOREHOLE",
  };

  it("titles the place from the area and city, never the street", () => {
    const title = titleFromAnswers(answers);
    expect(title).toBe("2 bedroom flat to let in Yaba, Lagos");
    expect(title).not.toContain("Herbert");
    expect(titleFromAnswers({ ...answers, area: "", city: "" })).toBe("");
  });

  it("writes one plain sentence per answer, and nothing it was not told", () => {
    const text = descriptionFromAnswers(answers, ["WiFi", "Parking"]);
    expect(text).toContain("A 2 bedroom flat to let in Yaba, Lagos.");
    expect(text).toContain("It is fully furnished.");
    expect(text).toContain("You will find WiFi and Parking on the property.");
    expect(text).not.toContain("Herbert");
    expect(text).not.toContain("bus stop");
    expect(text).not.toContain("\u2014");
  });
});
