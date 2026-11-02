import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * NO ACCOUNT WITHOUT AN AGREEMENT, PROVED BY CALLING THE THING.
 *
 * The defect these replace. Acceptance was enforced in the browser alone:
 * `EmailAuthForm` called `preventDefault()` when the tick was missing,
 * `AcceptTerms` rendered the hidden `termsVersion` only once it was ticked,
 * and the form carries `noValidate`, so there was not even a native
 * `required` behind the JavaScript. A request assembled by hand, or a browser
 * running no script, reached the server action with no version and THE
 * ACCOUNT WAS CREATED, with null recorded where the agreement should be.
 *
 * And the test that was supposed to cover it asserted that
 * `EmailAuthForm.tsx` CONTAINS the string `setAcceptError(true)`. It would
 * have passed with the submit never stopped, with the tick removed from the
 * form, with the server recording nothing. That is a mirror: it reflected the
 * source back at itself and called the reflection evidence.
 *
 * So these assert the OUTCOME. The provider is a spy. If the refusal ever
 * stops happening, `signUp` gets called, and the spy says so.
 */

const seam = vi.hoisted(() => ({ signUp: vi.fn(), consume: vi.fn(), record: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/security/rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("../security/rate-limit")>("../security/rate-limit");
  return { ...actual, consume: seam.consume };
});
vi.mock("@/lib/alerts", () => ({ recordAlert: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: seam.signUp } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn() }) }));
vi.mock("@/lib/site", () => ({ authOrigin: async () => "https://example.invalid" }));
vi.mock("@/lib/legal/acceptance", () => ({ recordTermsAcceptance: seam.record }));
vi.mock("./providers", () => ({ getProviderStates: () => [{ id: "email", configured: true }] }));

import { TERMS_VERSION } from "@/lib/legal/versions";

/** Everything a sign-up needs, so the only variable is the agreement. */
function signUpForm(termsVersion: string | null, age: string | null = "18+"): FormData {
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
  if (termsVersion !== null) data.set("termsVersion", termsVersion);
  if (age !== null) data.set("ageConfirmed", age);
  return data;
}

beforeEach(() => {
  seam.signUp.mockReset();
  seam.record.mockReset();
  seam.consume.mockReset();
  seam.consume.mockResolvedValue({ allowed: true, degraded: false });
  seam.signUp.mockResolvedValue({
    data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null },
    error: null,
  });
});

describe("a sign-up without the agreement never reaches the provider", () => {
  it("refuses when no version was sent at all, which is the hand-assembled request", async () => {
    const { signUpWithEmail } = await import("./actions");
    const state = await signUpWithEmail({ ok: false }, signUpForm(null));

    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.acceptTerms).toBeTruthy();
    // THE ASSERTION THAT MATTERS. Not that an error was returned, but that no
    // account was attempted. The old mirror could not see this at all.
    expect(seam.signUp).not.toHaveBeenCalled();
    expect(seam.record).not.toHaveBeenCalled();
  });

  it("refuses a STALE version, because agreeing to an older document is not agreeing to this one", async () => {
    const { signUpWithEmail } = await import("./actions");
    const state = await signUpWithEmail({ ok: false }, signUpForm("1970-01-01"));

    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.acceptTerms).toBeTruthy();
    expect(seam.signUp).not.toHaveBeenCalled();
  });

  it("refuses an empty version, which is what a blank hidden field sends", async () => {
    const { signUpWithEmail } = await import("./actions");
    const state = await signUpWithEmail({ ok: false }, signUpForm("   "));

    expect(state.ok).toBe(false);
    expect(seam.signUp).not.toHaveBeenCalled();
  });

  it("lets the current version through, or the gate would be a wall", async () => {
    const { signUpWithEmail } = await import("./actions");
    /* The action redirects on success, and the mock turns that into a throw.
       Reaching the throw IS the proof the provider was called. */
    await expect(signUpWithEmail({ ok: false }, signUpForm(TERMS_VERSION))).rejects.toThrow(
      /REDIRECT:/,
    );

    expect(seam.signUp).toHaveBeenCalledTimes(1);
    // And the version that travelled is the one we checked, not some other.
    const options = seam.signUp.mock.calls[0]?.[0]?.options;
    expect(options?.data?.terms_version).toBe(TERMS_VERSION);
  });
});

describe("STORE-19: the Terms say 18 or over, so the server asks", () => {
  it.each([null, "", "17", "yes", "18"])("refuses a sign-up whose age answer is %s", async (age) => {
    const { signUpWithEmail } = await import("./actions");
    const state = await signUpWithEmail({ ok: false }, signUpForm(TERMS_VERSION, age));
    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.ageConfirmed).toBeTruthy();
    expect(seam.signUp).not.toHaveBeenCalled();
    expect(seam.record).not.toHaveBeenCalled();
  });

  it("records the statement with the terms receipt", async () => {
    const { signUpWithEmail } = await import("./actions");
    await expect(signUpWithEmail({ ok: false }, signUpForm(TERMS_VERSION))).rejects.toThrow(/REDIRECT:/);
    expect(seam.record).toHaveBeenCalledWith("u1", "signup_email", { ageConfirmed: true });
  });
});
