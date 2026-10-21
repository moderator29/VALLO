import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => undefined, refresh: () => undefined }) }));

const { passkeyLanding } = await import("./PasskeySignIn");

describe("where a passkey sign-in lands", () => {
  it("keeps a path on this site", () => {
    expect(passkeyLanding("/listing/abc?from=share")).toBe("/listing/abc?from=share");
  });

  it("never leaves the site, whatever the query carried", () => {
    for (const hostile of ["/\\evil.example", "//evil.example", "https://evil.example", "/\t/evil.example", "/%5cevil.example"]) {
      expect(passkeyLanding(hostile), hostile).toBe("/home");
    }
    expect(passkeyLanding(undefined)).toBe("/home");
  });
});
