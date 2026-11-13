import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({
  jar: new Map<string, { value: string; opts: Record<string, unknown> }>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: (k: string, v: string, o: Record<string, unknown>) => seam.jar.set(k, { value: v, opts: o }) }),
}));

import * as actions from "./profile-setup-actions";
import { markProfileSetupShown, skipProfileSetup } from "./profile-setup-actions";

beforeEach(() => {
  seam.jar.clear();
});

describe("the name confirmation", () => {
  it("is gone: no action saves a name from the first-run sheet any more", () => {
    expect("confirmProfileName" in actions).toBe(false);
  });
});

describe("the nag limits", () => {
  it("marks the session as shown with a session cookie", async () => {
    await markProfileSetupShown();
    const c = seam.jar.get("vallo_setup_shown");
    expect(c?.value).toBe("1");
    expect(c?.opts.maxAge).toBeUndefined();
    expect(c?.opts.httpOnly).toBe(true);
  });
  it("a skip writes the time with a long-lived server-only cookie", async () => {
    await skipProfileSetup();
    const c = seam.jar.get("vallo_setup_skip");
    expect(Number(c?.value)).toBeGreaterThan(1_700_000_000_000);
    expect(c?.opts.httpOnly).toBe(true);
    expect(Number(c?.opts.maxAge)).toBeGreaterThan(3 * 24 * 3600);
  });
});
