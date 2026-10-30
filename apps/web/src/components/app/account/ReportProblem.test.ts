import { describe, expect, it } from "vitest";
import { problemBody } from "@/lib/support/problem-body";

describe("problemBody", () => {
  it("names the screen under what was typed and never exceeds the ticket limit", () => {
    expect(problemBody("  It froze  ", "/saved")).toBe("It froze\n\nScreen: /saved");
    expect(problemBody("x".repeat(5000), "/a").length).toBe(4000);
  });
});
