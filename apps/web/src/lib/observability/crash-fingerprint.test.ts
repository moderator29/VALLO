import { describe, expect, it } from "vitest";
import { crashFingerprint, crashSource, normaliseMessage, stackTop } from "./crash-fingerprint";

describe("crash fingerprint", () => {
  it("folds the same crash with different numbers and ids into one", () => {
    const a = crashFingerprint({ source: "ios", kind: "client.window", type: "TypeError", message: "Cannot read 'x' of row 12 (3f1c2b8e-1111-4222-8333-123456789abc)", area: "/messages/*" });
    const b = crashFingerprint({ source: "ios", kind: "client.window", type: "TypeError", message: "Cannot read 'y' of row 97 (00000000-1111-4222-8333-000000000000)", area: "/messages/*" });
    expect(a).toBe(b);
  });
  it("keeps platforms, places and types apart", () => {
    const base = { source: "ios" as const, kind: "client.window", type: "TypeError", message: "boom", area: "/home/*" };
    expect(crashFingerprint(base)).not.toBe(crashFingerprint({ ...base, source: "android" }));
    expect(crashFingerprint(base)).not.toBe(crashFingerprint({ ...base, area: "/explore/*" }));
    expect(crashFingerprint(base)).not.toBe(crashFingerprint({ ...base, type: "RangeError" }));
  });
  it("is bounded", () => {
    expect(crashFingerprint({ source: "web", kind: "k", type: "E", message: "x".repeat(5000) }).length).toBeLessThanOrEqual(200);
    expect(normaliseMessage("a   b\n c")).toBe("a b c");
  });
  it("reads an unknown source as web", () => {
    expect(crashSource("ios")).toBe("ios");
    expect(crashSource("windows")).toBe("web");
    expect(crashSource(undefined)).toBe("web");
  });
  it("keeps the top of a stack", () => {
    expect(stackTop("Error: x\n at a\n at b\n at c", 2)).toBe("Error: x\nat a\nat b");
    expect(stackTop(null)).toBeNull();
  });
});
