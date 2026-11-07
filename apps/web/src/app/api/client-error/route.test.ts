import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SEC-17: the client error sink deduplicated by message, so a caller varying
 * the message flooded it. It now also counts per address; and the app no
 * longer announces its framework in X-Powered-By.
 */
const state = vi.hoisted(() => ({ reported: 0, allowed: 30, seen: 0 }));
vi.mock("@/lib/observability/report", () => ({
  reportError: async () => {
    state.reported += 1;
  },
}));
vi.mock("@/lib/observability/crash-log", () => ({
  recordCrash: async () => false,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  ipFromHeaders: () => "203.0.113.7",
  subjectForIp: (ip: string) => `ip:${ip}`,
  consume: async () => {
    state.seen += 1;
    return state.seen <= state.allowed
      ? { allowed: true, degraded: false }
      : { allowed: false, retryAfterSeconds: 60, retryIn: "in a minute" };
  },
}));

const { POST } = await import("./route");

const send = (message: string) =>
  POST(new Request("https://x.invalid/api/client-error", { method: "POST", body: JSON.stringify({ name: "Error", message }) }));

beforeEach(() => {
  state.reported = 0;
  state.seen = 0;
});

describe("the client error sink", () => {
  it("reports up to the per-address limit however the message varies, then stays quiet", async () => {
    for (let i = 0; i < 50; i += 1) {
      const res = await send(`flood ${i}`);
      expect(res.status).toBe(204);
    }
    expect(state.reported).toBe(30);
  });

  it("does not say which framework serves it", () => {
    const config = readFileSync(join(__dirname, "..", "..", "..", "..", "next.config.ts"), "utf8");
    expect(config).toMatch(/poweredByHeader:\s*false/);
  });
});
