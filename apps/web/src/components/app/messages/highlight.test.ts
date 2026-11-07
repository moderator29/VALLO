import { describe, expect, it } from "vitest";
import { highlightParts, snippetAround } from "./highlight";

describe("search matches", () => {
  it("marks every match without changing the words", () => {
    expect(highlightParts("Yaba flat in yaba", "yaba")).toEqual([
      { text: "Yaba", hit: true },
      { text: " flat in ", hit: false },
      { text: "yaba", hit: true },
    ]);
    expect(highlightParts("Lekki", "")).toEqual([{ text: "Lekki", hit: false }]);
    expect(highlightParts("Lekki", "ikoyi")).toEqual([{ text: "Lekki", hit: false }]);
  });

  it("re-cuts a long preview around the match", () => {
    const text = "Thanks for the photos yesterday, the kitchen looks good and the deposit is fine for me";
    expect(snippetAround(text, "deposit")).toMatch(/^….*deposit is fine/);
    expect(snippetAround("The deposit", "deposit")).toBe("The deposit");
  });
});
