import { describe, expect, it } from "vitest";

import { agreementText } from "./tools";

const W = { heading: "House agreement", who: "People: {names}", where: "Home: {where}", split: "Rent: {split}", rulesHead: "House rules:", note: "Not a legal contract." };

describe("agreementText", () => {
  it("numbers the rules, names the people and ends with the note", () => {
    const t = agreementText(W, { names: " Ada ,Bola, ", where: "Yaba", splitLabel: "Equal shares", rules: ["Quiet hours from 10pm", "No smoking inside"] });
    expect(t).toBe("House agreement\nPeople: Ada, Bola\nHome: Yaba\nRent: Equal shares\n\nHouse rules:\n1. Quiet hours from 10pm\n2. No smoking inside\n\nNot a legal contract.");
  });
  it("leaves out what was not given and caps the lists", () => {
    const t = agreementText(W, { names: "", where: "  ", splitLabel: "Equal shares", rules: Array.from({ length: 30 }, (_, i) => `r${i}`) });
    expect(t).not.toContain("People:");
    expect(t).not.toContain("Home:");
    expect(t.match(/^\d+\. /gm)).toHaveLength(20);
  });
});
