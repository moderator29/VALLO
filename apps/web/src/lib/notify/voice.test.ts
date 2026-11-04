import { describe, expect, it } from "vitest";
import { warmBody, warmTitle } from "./voice";

describe("the voice of an in-app notification", () => {
  it("says the known facts more warmly", () => {
    expect(warmTitle("New follower")).toBe("You have a new follower");
    expect(warmTitle("Withdrawal could not complete")).toBe("Your withdrawal did not go through");
    expect(warmTitle("You earned Neighbour")).toBe("Congratulations, you earned Neighbour");
    expect(warmTitle("Table requested at Vallo House Kitchen")).toBe("Your table request is with Vallo House Kitchen");
  });
  it("leaves a title it does not know exactly as stored", () => {
    expect(warmTitle("Staff sign-in from a new place")).toBe("Staff sign-in from a new place");
    expect(warmTitle("")).toBe("");
  });
  it("keeps the stored fact on the lock screen when the warm line would not fit", () => {
    expect(warmTitle("Your agent application is approved", 40)).toBe("Your agent application is approved");
    expect(warmTitle("New follower", 40)).toBe("You have a new follower");
  });
  it("adds no dash, no exclamation and no promise", () => {
    for (const title of ["New message", "Missed voice call", "Your table is confirmed", "We have your question"]) {
      expect(warmTitle(title)).not.toMatch(/[!—–]|guarantee|insured/i);
    }
  });
});

describe("the body of a notification", () => {
  it("never shows an internal address for a shared listing", () => {
    expect(warmBody("Shared a listing\n/listing/ed000000-0000-4000-8000-00000000003c")).toBe("Shared a listing with you.");
  });
  it("leaves every other body exactly as stored", () => {
    expect(warmBody("@zeezu_sketch started following you.")).toBe("@zeezu_sketch started following you.");
    expect(warmBody("Is it still available?")).toBe("Is it still available?");
    expect(warmBody(null)).toBeNull();
  });
});
