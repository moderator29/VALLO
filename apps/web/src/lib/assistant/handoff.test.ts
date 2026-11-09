import { describe, expect, it } from "vitest";
import { buildHandoff } from "./handoff";

describe("talk to a person: the hand-over", () => {
  it("carries the unsent words first, else the last question, and the whole exchange", () => {
    const turns = [
      { role: "user" as const, text: "Is there a 2 bed in Yaba?" },
      { role: "assistant" as const, text: "Here are three." },
    ];
    const withDraft = buildHandoff(turns, "  My deposit was not returned  ", 1)!;
    expect(withDraft.question).toBe("My deposit was not returned");
    expect(withDraft.transcript).toContain("Conversation with Vallo AI before this ticket:");
    expect(withDraft.transcript).toContain("Member: Is there a 2 bed in Yaba?");
    expect(withDraft.transcript).toContain("AI helper: Here are three.");
    expect(withDraft.transcript).toContain("Member: My deposit was not returned");
    expect(buildHandoff(turns, "", 1)!.question).toBe("Is there a 2 bed in Yaba?");
  });

  it("is nothing when nothing was asked", () => {
    expect(buildHandoff([], "   ")).toBeNull();
  });
});
