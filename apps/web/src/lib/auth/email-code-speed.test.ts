import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE EMAIL CODE SIGN-IN, SAID AT ONCE (SPEED, 13 November 2026). As with the
 * password sign-in, a submit made by the page's script is answered with where
 * to go as soon as the code is accepted, rather than with a server redirect
 * that made Next build the next page inside the same request. A check that
 * never got an answer is "could not do that", never "wrong code".
 */
const s = vi.hoisted(() => ({ headers: new Headers(), verifyOtp: vi.fn(), revalidated: 0 }));

vi.mock("next/headers", () => ({
  headers: async () => s.headers,
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => void (s.revalidated += 1) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/security/agent-client", () => ({ createClientWithAgent: async () => ({ auth: { verifyOtp: s.verifyOtp } }) }));
vi.mock("@/lib/security/rate-limit", () => ({
  consume: async () => ({ allowed: true, degraded: false }),
  ipFromHeaders: () => "203.0.113.7",
  subjectForEmail: (e: string) => `email:${e}`,
  subjectForIp: (ip: string) => `ip:${ip}`,
}));
vi.mock("./first-sign-in-server", () => ({ rememberFirstCodeSignIn: async () => undefined }));

import { CONFIRMATION_CODE_LENGTH } from "./confirmation-code";
import { verifyEmailSignInCode } from "./email-code";

function form(next?: string): FormData {
  const data = new FormData();
  data.set("target", "ada@example.invalid");
  data.set("code", "4".repeat(CONFIRMATION_CODE_LENGTH));
  if (next) data.set("next", next);
  return data;
}

beforeEach(() => {
  s.headers = new Headers({ "next-action": "abc" });
  s.verifyOtp.mockReset();
  s.verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  s.revalidated = 0;
});

describe("verifyEmailSignInCode", () => {
  it("answers a script submit with where to go, without building the next page", async () => {
    const state = await verifyEmailSignInCode({ step: "code" }, form("/listing/abc"));
    expect(state.next).toBe("/listing/abc");
    expect(s.revalidated).toBe(0);
  });

  it("keeps the server redirect for a submit made before the script ran", async () => {
    s.headers = new Headers();
    await expect(verifyEmailSignInCode({ step: "code" }, form())).rejects.toThrow("REDIRECT:/home");
  });

  it("never sends the person off the origin", async () => {
    const state = await verifyEmailSignInCode({ step: "code" }, form("//evil.example"));
    expect(state.next).toBe("/home");
  });

  it("says a check that never got an answer failed, not that the code was wrong", async () => {
    s.verifyOtp.mockResolvedValue({ data: {}, error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" } });
    expect((await verifyEmailSignInCode({ step: "code" }, form())).error).toBe("failed");
    s.verifyOtp.mockResolvedValue({ data: {}, error: { status: 403, message: "Token has expired or is invalid" } });
    expect((await verifyEmailSignInCode({ step: "code" }, form())).error).toBe("wrongCode");
  });
});
