import { describe, expect, it } from "vitest";
import { RUN_GAP_MS, runPlace, sameRun } from "./thread-runs";

const at = (iso: string) => ({ mine: true, timeLabel: "10:00", createdAt: iso });

describe("runs of bubbles", () => {
  it("joins one side a few minutes apart", () => {
    expect(sameRun(at("2026-11-07T10:00:00Z"), at("2026-11-07T10:02:30Z"))).toBe(true);
    expect(RUN_GAP_MS).toBe(180_000);
  });

  it("breaks on a gap, a change of side, a state, a call or a card", () => {
    expect(sameRun(at("2026-11-07T10:00:00Z"), at("2026-11-07T10:04:00Z"))).toBe(false);
    expect(sameRun(at("2026-11-07T10:00:00Z"), { ...at("2026-11-07T10:00:10Z"), mine: false })).toBe(false);
    expect(sameRun(at("2026-11-07T10:00:00Z"), { ...at("2026-11-07T10:00:10Z"), state: "sending" })).toBe(false);
    expect(sameRun(at("2026-11-07T10:00:00Z"), { ...at("2026-11-07T10:00:10Z"), call: {} })).toBe(false);
    expect(sameRun(null, at("2026-11-07T10:00:00Z"))).toBe(false);
  });

  it("falls back to the minute when a row has no instant", () => {
    expect(sameRun({ mine: true, timeLabel: "10:00" }, { mine: true, timeLabel: "10:00" })).toBe(true);
    expect(sameRun({ mine: true, timeLabel: "10:00" }, { mine: true, timeLabel: "10:01" })).toBe(false);
  });

  it("names each bubble's place in its run", () => {
    expect(runPlace(false, false)).toBe("single");
    expect(runPlace(false, true)).toBe("first");
    expect(runPlace(true, true)).toBe("middle");
    expect(runPlace(true, false)).toBe("last");
  });
});
