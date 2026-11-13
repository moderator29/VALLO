import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * B-2: "Finish setting up", proved by calling the action and the callback.
 *
 * The provider is a stand-in that records what it was asked. The assertions
 * are about OUTCOMES: no receipt without both ticks, the receipt written with
 * `signup_oauth` for the server-resolved user, "Welcome to Vallo" set only
 * after it is on file, and a new social account sent from the callback to
 * the step with its `next` kept.
 */

const seam = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    app_metadata: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
    identities?: { provider: string; last_sign_in_at?: string }[];
  },
  rows: [] as { document: string }[],
  rowsError: null as null | { message: string },
  profileError: null as null | { code?: string; message?: string },
  profileUpdates: [] as unknown[],
  record: vi.fn(),
  success: vi.fn(),
  adminUpdate: vi.fn(),
  refresh: vi.fn(),
  accessToken: "",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9", "user-agent": "Mozilla/5.0" }),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/alerts", () => ({ recordAlert: vi.fn() }));
vi.mock("@/lib/notify/welcome", () => ({ welcomeOnce: vi.fn(async () => "already") }));
vi.mock("@/lib/legal/acceptance", () => ({ recordTermsAcceptance: seam.record }));
vi.mock("@/lib/ui/success-cookie", () => ({ rememberSuccess: seam.success }));
vi.mock("@/lib/site", () => ({ authOrigin: async () => "https://example.invalid" }));

function client() {
  return {
    auth: {
      getUser: async () => ({ data: { user: seam.user } }),
      getSession: async () => ({ data: { session: { access_token: seam.accessToken } } }),
      exchangeCodeForSession: async () => ({ error: null }),
      refreshSession: seam.refresh,
      signOut: vi.fn(),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          update: (values: unknown) => ({
            eq: async () => {
              seam.profileUpdates.push(values);
              return { error: seam.profileError };
            },
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({ data: seam.rowsError ? null : seam.rows, error: seam.rowsError }),
          }),
        }),
      };
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client() }));
vi.mock("@/lib/security/agent-client", () => ({ createClientWithAgent: async () => client() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { updateUserById: seam.adminUpdate } } }),
}));
vi.mock("./providers", async () => {
  const actual = await vi.importActual<typeof import("./providers")>("./providers");
  return {
    ...actual,
    getProviderStates: () => [{ id: "email", configured: true }],
    resolveProviderStates: async () => [
      { id: "email", configured: true },
      { id: "google", configured: true },
      { id: "apple", configured: true },
    ],
  };
});

import { TERMS_VERSION } from "@/lib/legal/versions";

const GOOGLE_USER = {
  id: "u-google",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "Ada Obi" },
  identities: [{ provider: "google", last_sign_in_at: "2026-09-29T10:00:00Z" }],
};

function form(overrides: Record<string, string | null> = {}): FormData {
  const values: Record<string, string | null> = {
    firstName: "Ada",
    surname: "Obi",
    termsVersion: TERMS_VERSION,
    ageConfirmed: "18+",
    next: "/listing/abc",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== null) data.set(key, value);
  return data;
}

/** An access token whose `amr` says an OAuth provider made the session. */
function oauthToken(): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return [b64({ alg: "none" }), b64({ amr: [{ method: "oauth" }] }), "x"].join(".");
}

beforeEach(() => {
  seam.user = GOOGLE_USER;
  seam.rows = [];
  seam.rowsError = null;
  seam.profileError = null;
  seam.profileUpdates = [];
  seam.record.mockReset();
  seam.success.mockReset();
  seam.adminUpdate.mockReset();
  seam.refresh.mockReset();
  seam.accessToken = oauthToken();
  /* The receipt lands in the table when the writer is called. */
  seam.record.mockImplementation(async () => {
    seam.rows = [{ document: "terms" }, { document: "privacy" }, { document: "age_18_or_over" }];
  });
});

describe("finishSocialSetup refuses without both ticks, on the server", () => {
  it.each([
    ["no terms version", { termsVersion: null }, "acceptTerms"],
    ["a stale terms version", { termsVersion: "1970-01-01" }, "acceptTerms"],
    ["no age statement", { ageConfirmed: null }, "ageConfirmed"],
    ["a wrong age answer", { ageConfirmed: "17" }, "ageConfirmed"],
    ["no first name", { firstName: "  " }, "firstName"],
  ] as const)("%s", async (_label, overrides, fieldName) => {
    const { finishSocialSetup } = await import("./actions");
    const state = await finishSocialSetup({ ok: false }, form(overrides));
    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.[fieldName]).toBeTruthy();
    expect(seam.record).not.toHaveBeenCalled();
    expect(seam.success).not.toHaveBeenCalled();
  });
});

describe("finishSocialSetup records, then goes on", () => {
  /* 13 November 2026: the last step of sign-up is the profile photo
     (lib/auth/photo-step.ts), which then goes on to `next`. */
  it("writes the receipt for the server-resolved user and goes to the photo step, carrying next, with Welcome to Vallo", async () => {
    const { finishSocialSetup } = await import("./actions");
    await expect(finishSocialSetup({ ok: false }, form())).rejects.toThrow("REDIRECT:/sign-up/photo?next=%2Flisting%2Fabc");
    expect(seam.record).toHaveBeenCalledWith("u-google", "signup_oauth", { ageConfirmed: true });
    expect(seam.profileUpdates).toEqual([{ first_name: "Ada", surname: "Obi" }]);
    expect(seam.success).toHaveBeenCalledWith("account-created");
    expect(seam.adminUpdate).toHaveBeenCalledWith("u-google", { app_metadata: { vallo_setup_done: true } });
  });

  it("an unsafe next becomes /home, after the photo step", async () => {
    const { finishSocialSetup } = await import("./actions");
    await expect(finishSocialSetup({ ok: false }, form({ next: "//evil.example" }))).rejects.toThrow(
      "REDIRECT:/sign-up/photo?next=%2Fhome",
    );
  });

  it("does not move on when the receipt did not land, and says so", async () => {
    seam.record.mockImplementation(async () => undefined);
    const { finishSocialSetup } = await import("./actions");
    const state = await finishSocialSetup({ ok: false }, form());
    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/could not record/);
    expect(seam.success).not.toHaveBeenCalled();
  });

  it("a name the scanner refuses is refused with its own sentence, and nothing is recorded", async () => {
    seam.profileError = { code: "RM004", message: "That name reads as if it speaks for Vallo." };
    const { finishSocialSetup } = await import("./actions");
    const state = await finishSocialSetup({ ok: false }, form({ firstName: "Vallo" }));
    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.firstName).toMatch(/speaks for Vallo/);
    expect(seam.record).not.toHaveBeenCalled();
  });

  it("signed out goes to sign in, with the step as next", async () => {
    seam.user = null;
    const { finishSocialSetup } = await import("./actions");
    await expect(finishSocialSetup({ ok: false }, form())).rejects.toThrow(
      /REDIRECT:\/sign-in\?next=%2Fsign-up%2Ffinish/,
    );
    expect(seam.record).not.toHaveBeenCalled();
  });
});

describe("the OAuth callback sends a new social account to the step", () => {
  it("routes to /sign-up/finish with next kept, and sets no welcome yet", async () => {
    const { completeEmailVerification } = await import("./actions");
    const outcome = await completeEmailVerification({ code: "abc", next: "/listing/abc" });
    expect(outcome).toEqual({ ok: true, next: "/sign-up/finish?next=%2Flisting%2Fabc" });
    expect(seam.success).not.toHaveBeenCalled();
  });

  it("goes straight on once the record is complete", async () => {
    seam.rows = [{ document: "terms" }, { document: "age_18_or_over" }];
    const { completeEmailVerification } = await import("./actions");
    expect(await completeEmailVerification({ code: "abc", next: "/listing/abc" })).toEqual({
      ok: true,
      next: "/listing/abc",
    });
  });

  it("an email account is never sent there", async () => {
    seam.user = { id: "u-email", app_metadata: { provider: "email", providers: ["email"] } };
    seam.accessToken = "";
    const { completeEmailVerification } = await import("./actions");
    expect(await completeEmailVerification({ code: "abc", next: "/home" })).toEqual({ ok: true, next: "/home" });
  });

  it("a failed read never traps anybody at the callback", async () => {
    seam.rowsError = { message: "down" };
    const { completeEmailVerification } = await import("./actions");
    expect(await completeEmailVerification({ code: "abc", next: "/home" })).toEqual({ ok: true, next: "/home" });
  });
});
