import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SIGN-IN AND SIGN-UP, FAST AND NEVER OPEN-ENDED (SPEED, 13 November 2026,
 * the founder: "it's too slow ... like milliseconds").
 *
 * What these hold:
 *   - the password check is given a deadline, and a check that never got an
 *     answer says "cannot reach accounts" (retryable), never "wrong password";
 *   - a sign-up answers without waiting for its bookkeeping (the "no news"
 *     setting and the terms receipt run after the response, through `after`);
 *   - the sign-up code's two counts are asked together, its welcome row runs
 *     after the response, and a code check that timed out is not "wrong code".
 *
 * The password sign-in's two counts staying IN ORDER is held by
 * `sign-in-fast.test.ts`, which still passes unchanged.
 */

const seam = vi.hoisted(() => ({
  consume: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
  record: vi.fn(),
  welcome: vi.fn(),
  agentOptions: [] as unknown[],
  later: [] as (() => unknown)[],
  headers: new Headers(),
}));

vi.mock("next/server", () => ({
  after: (work: () => unknown) => {
    seam.later.push(work);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => seam.headers,
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("../security/rate-limit")>("../security/rate-limit");
  return { ...actual, consume: seam.consume };
});
vi.mock("@/lib/alerts", () => ({ recordAlert: vi.fn() }));
vi.mock("@/lib/ui/success-cookie", () => ({ rememberSuccess: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signUp: seam.signUp } }) }));
vi.mock("@/lib/security/agent-client", () => ({
  createClientWithAgent: async (options?: unknown) => {
    seam.agentOptions.push(options);
    return { auth: { signInWithPassword: seam.signIn, verifyOtp: seam.verifyOtp } };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn() }) }));
vi.mock("@/lib/site", () => ({ authOrigin: async () => "https://example.invalid" }));
vi.mock("@/lib/legal/acceptance", () => ({ recordTermsAcceptance: seam.record }));
vi.mock("@/lib/notify/welcome", () => ({ welcomeOnce: seam.welcome }));
vi.mock("@/lib/referral/server", () => ({ claimInviteFromCookie: async () => null, inviteCodeFromCookie: async () => null }));
vi.mock("./providers", () => ({ getProviderStates: () => [{ id: "email", configured: true }] }));

import { TERMS_VERSION } from "@/lib/legal/versions";
import { getDictionary } from "@vallo/i18n";
import { afterResponse } from "./after-response";
import { isUnreachableAuthError } from "./unreachable";

const refusals = getDictionary("en").experienceEntry.refusals;
const ALLOWED = { allowed: true, degraded: false } as const;

function signInForm(): FormData {
  const data = new FormData();
  data.set("email", "ada@example.invalid");
  data.set("password", "a-password");
  return data;
}

function signUpForm(): FormData {
  const data = new FormData();
  data.set("firstName", "Ada");
  data.set("surname", "Obi");
  data.set("email", "ada.obi@example.com");
  data.set("password", "a-long-enough-passphrase-9");
  data.set("confirmPassword", "a-long-enough-passphrase-9");
  data.set("stateCode", "FC");
  data.set("lgaCode", "fc_amac");
  data.set("occupationCode", "other");
  data.set("hearAbout", "Friend or family");
  data.set("phone", "0803 123 4567");
  data.set("termsVersion", TERMS_VERSION);
  data.set("ageConfirmed", "18+");
  data.set("marketingAsked", "1");
  return data;
}

function codeForm(): FormData {
  const data = new FormData();
  data.set("email", "ada.obi@example.com");
  return data;
}

beforeEach(() => {
  for (const fn of [seam.consume, seam.signIn, seam.signUp, seam.verifyOtp, seam.record, seam.welcome]) fn.mockReset();
  seam.consume.mockResolvedValue(ALLOWED);
  seam.signIn.mockResolvedValue({ error: null });
  seam.record.mockResolvedValue(undefined);
  seam.welcome.mockResolvedValue("already");
  seam.agentOptions = [];
  seam.later = [];
  seam.headers = new Headers({ "x-forwarded-for": "203.0.113.7", "next-action": "abc" });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

describe("which auth errors are ours, not the person's", () => {
  it.each([
    [{ name: "AuthRetryableFetchError", status: 0, message: "fetch failed" }, true],
    [{ status: 0, message: "The operation was aborted due to timeout" }, true],
    [{ status: 500, message: "Database error querying schema" }, true],
    [{ status: 504, message: "Gateway timeout" }, true],
    [{ status: 400, message: "Invalid login credentials" }, false],
    [{ status: 403, message: "Token has expired or is invalid" }, false],
    [{ status: 429, message: "Request rate limit reached" }, false],
    [{ message: "Invalid login credentials" }, false],
    [{ message: "TypeError: fetch failed" }, true],
    [null, false],
  ])("%j is unreachable: %s", (error, expected) => {
    expect(isUnreachableAuthError(error)).toBe(expected);
  });
});

describe("afterResponse", () => {
  it("hands the work to after() and does not start it on the response path", () => {
    const work = vi.fn(() => new Promise<void>(() => {}));
    expect(afterResponse(work)).toBeUndefined();
    expect(work).not.toHaveBeenCalled();
    expect(seam.later).toHaveLength(1);
    void seam.later[0]!();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("swallows a failure in the work, so nothing surfaces as unhandled", async () => {
    afterResponse(() => Promise.reject(new Error("boom")));
    await expect(Promise.resolve(seam.later[0]!())).resolves.toBeUndefined();
  });
});

describe("the password check", () => {
  it("is given its own deadline, shorter than the server client's default", async () => {
    const { signInWithEmail } = await import("./actions");
    expect(await signInWithEmail({ ok: false }, signInForm())).toEqual({ ok: true, next: "/home" });
    expect(seam.agentOptions).toEqual([{ deadlineMs: 8_000 }]);
  });

  it("says accounts cannot be reached when GoTrue never answered, and the form can try again", async () => {
    seam.signIn.mockResolvedValue({ error: { name: "AuthRetryableFetchError", status: 0, message: "The operation was aborted due to timeout" } });
    const { signInWithEmail } = await import("./actions");
    expect(await signInWithEmail({ ok: false }, signInForm())).toEqual({ ok: false, message: refusals.notConnected });
  });

  it("says the same for a fetch that threw", async () => {
    seam.signIn.mockRejectedValue(new TypeError("fetch failed"));
    const { signInWithEmail } = await import("./actions");
    expect(await signInWithEmail({ ok: false }, signInForm())).toEqual({ ok: false, message: refusals.notConnected });
  });

  it("still says the neutral credentials sentence for a wrong password", async () => {
    seam.signIn.mockResolvedValue({ error: { status: 400, message: "Invalid login credentials" } });
    const { signInWithEmail } = await import("./actions");
    expect(await signInWithEmail({ ok: false }, signInForm())).toEqual({ ok: false, message: refusals.credentials });
  });
});

describe("a sign-up", () => {
  /* The terms receipt is AWAITED before the answer (13 November 2026): the
     edge gate reads it on the very next page, so deferring it could send a new
     member back to finish setting up. Only the marketing write is deferred. */
  it("writes the terms receipt before it answers, and defers only the marketing write", async () => {
    seam.signUp.mockResolvedValue({ data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null }, error: null });
    const { signUpWithEmail } = await import("./actions");
    await expect(signUpWithEmail({ ok: false }, signUpForm())).rejects.toThrow(/REDIRECT:\/sign-up\/verify/);
    expect(seam.record).toHaveBeenCalledWith("u1", "signup_email", { ageConfirmed: true });
    expect(seam.later).toHaveLength(1);
    await Promise.all(seam.later.map((work) => work()));
  });

  it("says accounts cannot be reached when the sign-up never got an answer", async () => {
    seam.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { status: 0, name: "AuthRetryableFetchError", message: "fetch failed" } });
    const { signUpWithEmail } = await import("./actions");
    expect(await signUpWithEmail({ ok: false }, signUpForm())).toEqual({ ok: false, message: refusals.notConnected });
  });
});

describe("the sign-up code", () => {
  async function codeFormWithRightLength(): Promise<FormData> {
    const { CONFIRMATION_CODE_LENGTH } = await import("./confirmation-code");
    const data = codeForm();
    data.set("code", "1".repeat(CONFIRMATION_CODE_LENGTH));
    return data;
  }

  it("asks its two counts together, not one after the other", async () => {
    const started: string[] = [];
    const release: (() => void)[] = [];
    seam.consume.mockImplementation((request: { bucket: string }) => {
      started.push(request.bucket);
      return new Promise((resolve) => release.push(() => resolve(ALLOWED)));
    });
    seam.verifyOtp.mockResolvedValue({ data: { session: {}, user: { id: "u1", user_metadata: {} } }, error: null });
    const { verifySignUpCode } = await import("./actions");
    const pending = verifySignUpCode({ ok: false }, await codeFormWithRightLength());
    await vi.waitFor(() => expect(started.sort()).toEqual(["sign_up_verify", "sign_up_verify_ip"]));
    release.forEach((go) => go());
    expect((await pending).ok).toBe(true);
  });

  it("queues the welcome after the response instead of waiting on it", async () => {
    seam.verifyOtp.mockResolvedValue({ data: { session: {}, user: { id: "u1", user_metadata: {} } }, error: null });
    const { verifySignUpCode } = await import("./actions");
    const state = await verifySignUpCode({ ok: false }, await codeFormWithRightLength());
    expect(state.ok).toBe(true);
    expect(seam.welcome).not.toHaveBeenCalled();
    await Promise.all(seam.later.map((work) => work()));
    expect(seam.welcome).toHaveBeenCalledWith("u1");
  });

  it("does not call a timed-out check a wrong code", async () => {
    seam.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { status: 0, name: "AuthRetryableFetchError", message: "fetch failed" } });
    const { verifySignUpCode } = await import("./actions");
    const state = await verifySignUpCode({ ok: false }, await codeFormWithRightLength());
    expect(state).toEqual({ ok: false, message: refusals.notConnected });
    expect(state.fieldErrors).toBeUndefined();
  });

  it("still calls a refused code wrong", async () => {
    seam.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { status: 403, message: "Token has expired or is invalid" } });
    const { verifySignUpCode } = await import("./actions");
    const state = await verifySignUpCode({ ok: false }, await codeFormWithRightLength());
    expect(state.fieldErrors?.code).toBe(refusals.codeWrong);
  });
});
