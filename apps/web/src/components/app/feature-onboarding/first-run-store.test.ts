import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D49.3: a first-run gate whose store read throws interrupts nobody, and
 * reports the throw rather than swallowing it.
 */
const reported = vi.hoisted(() => [] as unknown[]);

vi.mock("@/lib/observability/report", () => ({
  reportError: vi.fn(async (input: { context?: { kind?: unknown } }) => {
    reported.push(input.context?.kind);
    return { sent: false, reason: "not_configured" };
  }),
}));

const BROKEN = new Error("relation does not exist");
beforeEach(() => {
  reported.length = 0;
});

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

describe("the first-run gate", () => {
  it("lets the member through and reports when the store read throws", async () => {
    const { gateFirstRun } = await import("./first-run-store");
    const store = {
      read: async () => {
        throw BROKEN;
      },
    };
    await gateFirstRun("host", "/host", {}, store as never, false);
    expect(redirect).not.toHaveBeenCalled();
    expect(reported).toEqual(["read.first_run"]);
  });

  it("is off for every feature (founder, 7 November 2026): no read, no redirect", async () => {
    const { gateFirstRun } = await import("./first-run-store");
    let reads = 0;
    const store = { read: async () => { reads += 1; return "unseen"; } };
    await gateFirstRun("invite", "/settings/invite", {}, store as never);
    expect(reads).toBe(0);
    expect(redirect).not.toHaveBeenCalled();
  });
});
