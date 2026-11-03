import { describe, expect, it } from "vitest";
import { warmTitle } from "./voice";

describe("the voice of an in-app notification", () => {
  it("says the known facts more warmly", () => {
    expect(warmTitle("New follower")).toBe("You have a new follower");
    expect(warmTitle("Wallet credited")).toBe("Money has landed in your wallet");
    expect(warmTitle("You earned Neighbour")).toBe("Congratulations, you earned Neighbour");
    expect(warmTitle("Table requested at Vallo House Kitchen")).toBe("Your table request is with Vallo House Kitchen");
  });
  it("leaves a title it does not know exactly as stored", () => {
    expect(warmTitle("Staff sign-in from a new place")).toBe("Staff sign-in from a new place");
    expect(warmTitle("")).toBe("");
  });
  it("adds no dash, no exclamation and no promise", () => {
    for (const title of ["New message", "Missed voice call", "Your table is confirmed", "We have your question"]) {
      expect(warmTitle(title)).not.toMatch(/[!—–]|guarantee|insured/i);
    }
  });
});
