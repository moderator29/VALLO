import { describe, expect, it } from "vitest";
import { LONG_CHAT_TURNS, withCarry } from "./use-copilot-chat";

describe("a long conversation, carried over", () => {
  it("puts the summary in front of the desk's own context, within the route's limit", () => {
    expect(withCarry(null, null)).toBeNull();
    expect(withCarry(null, "3 tickets waiting")).toBe("3 tickets waiting");
    expect(withCarry("We refunded SUP-1", "3 tickets waiting")).toBe("Summary of the conversation before this one: We refunded SUP-1\n3 tickets waiting");
    expect(withCarry("x".repeat(3000), "y")!.length).toBe(2000);
  });

  it("offers a fresh start before the copilot stops reading the start", () => {
    expect(LONG_CHAT_TURNS).toBeLessThan(20);
  });
});
