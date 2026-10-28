import { describe, expect, it } from "vitest";
import { callLog, callLogLines, errorSummary } from "./diagnostics";

describe("call diagnostics", () => {
  it("names the error and keeps its message short", () => {
    const e = new DOMException("Permission denied", "NotAllowedError");
    expect(errorSummary(e)).toBe("NotAllowedError: Permission denied");
    expect(errorSummary("plain")).toBe("Error: plain");
  });

  it("never keeps a token, a URL or a long id", () => {
    /* Built at run time so no token-shaped literal sits in the source. */
    const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJ1c2VyIn0", "abcdefghijk"].join(".");
    const text = errorSummary(new Error(`join failed for wss://x.livekit.cloud/rtc?access_token=${jwt} room 0123456789abcdef0123456789abcdef0123`));
    expect(text).not.toContain("eyJ");
    expect(text).not.toContain("livekit.cloud");
    expect(text).not.toMatch(/[0-9a-f]{32}/);
  });

  it("keeps the last 80 lines and never throws", () => {
    for (let i = 0; i < 120; i += 1) callLog(`step-${i}`);
    const kept = callLogLines();
    expect(kept).toHaveLength(80);
    expect(kept[kept.length - 1]?.step).toBe("step-119");
  });
});
