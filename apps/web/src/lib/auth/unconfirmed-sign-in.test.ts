import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { verificationCode } from "@/lib/email/messages";
import { isUnconfirmedEmailError, unconfirmedVerifyHref } from "./unconfirmed";

/**
 * A SIGN-IN BEFORE CONFIRMING ALWAYS REACHES THE CODE (22 November 2026).
 *
 * A new agent made an account, then signed in and was told "Confirm your email
 * first. Open the link we sent you, then sign in." The email he held was the
 * Send Email Hook's `verificationCode`: a code and nothing to click. There was
 * no link and nowhere on the sign-in screen to type the code, and it held two
 * people for hours. These pin the fix: that refusal goes straight to the code
 * screen for that address, with a fresh code asked for, and no auth sentence
 * promises a link or a button the email does not carry.
 */
const seam = vi.hoisted(() => ({
  consume: vi.fn(),
  signIn: vi.fn(),
  resend: vi.fn(),
  headers: new Headers(),
  cookies: new Map<string, string>(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => seam.headers,
  cookies: async () => ({
    get: (name: string) => (seam.cookies.has(name) ? { value: seam.cookies.get(name) } : undefined),
    set: (name: string, value: string) => void seam.cookies.set(name, value),
    delete: (name: string) => void seam.cookies.delete(name),
  }),
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
vi.mock("@/lib/funnel/record", () => ({ recordFunnelStep: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: seam.signIn, resend: seam.resend } }),
}));
vi.mock("@/lib/security/agent-client", () => ({
  createClientWithAgent: async () => ({ auth: { signInWithPassword: seam.signIn, resend: seam.resend } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn() }) }));
vi.mock("@/lib/site", () => ({ authOrigin: async () => "https://example.invalid" }));
vi.mock("./providers", () => ({ getProviderStates: () => [{ id: "email", configured: true }] }));

const ALLOWED = { allowed: true, degraded: false } as const;
const DENIED = { allowed: false, retryAfterSeconds: 400, retryIn: "in 7 minutes" } as const;
/* What GoTrue answers a correct password on an address not yet confirmed. */
const NOT_CONFIRMED = { message: "Email not confirmed", code: "email_not_confirmed", status: 400, name: "AuthApiError" };

function form(next?: string): FormData {
  const data = new FormData();
  data.set("email", "agent@example.invalid");
  data.set("password", "a-password");
  if (next) data.set("next", next);
  return data;
}

beforeEach(() => {
  seam.consume.mockReset();
  seam.signIn.mockReset();
  seam.resend.mockReset();
  seam.cookies.clear();
  seam.consume.mockResolvedValue(ALLOWED);
  seam.resend.mockResolvedValue({ data: {}, error: null });
  seam.headers = new Headers({ "x-forwarded-for": "203.0.113.7", "next-action": "abc" });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

describe("recognising the refusal", () => {
  it("reads GoTrue's code first and its sentence second", () => {
    expect(isUnconfirmedEmailError(NOT_CONFIRMED)).toBe(true);
    expect(isUnconfirmedEmailError({ code: "email_not_confirmed" })).toBe(true);
    expect(isUnconfirmedEmailError({ message: "Email not confirmed" })).toBe(true);
    expect(isUnconfirmedEmailError({ message: "Invalid login credentials", code: "invalid_credentials" })).toBe(false);
    expect(isUnconfirmedEmailError(null)).toBe(false);
    expect(isUnconfirmedEmailError("Email not confirmed")).toBe(false);
  });

  it("builds the code screen's address, keeping a safe destination and dropping a hostile one", () => {
    expect(unconfirmedVerifyHref("/listing/abc")).toBe("/sign-up/verify?next=%2Flisting%2Fabc&from=sign-in");
    expect(unconfirmedVerifyHref("//evil.example/x")).toBe("/sign-up/verify?from=sign-in");
    expect(unconfirmedVerifyHref(undefined)).toBe("/sign-up/verify?from=sign-in");
  });
});

describe("signing in before confirming", () => {
  it("goes straight to the code screen for that address, with a fresh code asked for", async () => {
    seam.signIn.mockResolvedValue({ error: NOT_CONFIRMED });
    const { signInWithEmail } = await import("./actions");
    await expect(signInWithEmail({ ok: false }, form("/listing/abc"))).rejects.toThrow(
      "REDIRECT:/sign-up/verify?next=%2Flisting%2Fabc&from=sign-in",
    );
    /* The code screen opens with the address already in place. */
    expect(seam.cookies.get("nf_pending_email")).toBe("agent@example.invalid");
    expect(seam.resend).toHaveBeenCalledTimes(1);
    expect(seam.resend.mock.calls[0]![0]).toMatchObject({ type: "signup", email: "agent@example.invalid" });
    /* Metered by the same counts as the screen's own "Send me another code". */
    const buckets = seam.consume.mock.calls.map(([request]) => (request as { bucket: string }).bucket);
    expect(buckets).toEqual(expect.arrayContaining(["sign_up_resend", "sign_up_resend_ip"]));
  });

  it("still reaches the code screen when the resend meter is spent, without sending more mail", async () => {
    seam.signIn.mockResolvedValue({ error: NOT_CONFIRMED });
    seam.consume.mockImplementation(async (request: { bucket: string }) =>
      request.bucket === "sign_up_resend" ? DENIED : ALLOWED,
    );
    const { signInWithEmail } = await import("./actions");
    await expect(signInWithEmail({ ok: false }, form())).rejects.toThrow("REDIRECT:/sign-up/verify?next=%2Fhome&from=sign-in");
    expect(seam.resend).not.toHaveBeenCalled();
    expect(seam.cookies.get("nf_pending_email")).toBe("agent@example.invalid");
  });

  it("still reaches the code screen when the resend itself throws", async () => {
    seam.signIn.mockResolvedValue({ error: NOT_CONFIRMED });
    seam.resend.mockRejectedValue(new Error("fetch failed"));
    const { signInWithEmail } = await import("./actions");
    await expect(signInWithEmail({ ok: false }, form())).rejects.toThrow("REDIRECT:/sign-up/verify?next=%2Fhome&from=sign-in");
  });

  it("a wrong password is still the one neutral sentence, with no code screen and no mail", async () => {
    seam.signIn.mockResolvedValue({ error: { message: "Invalid login credentials", code: "invalid_credentials", status: 400 } });
    const { signInWithEmail } = await import("./actions");
    const result = await signInWithEmail({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(result.message).toBe(getDictionary("en").experienceEntry.refusals.credentials);
    expect(seam.resend).not.toHaveBeenCalled();
    expect(seam.cookies.has("nf_pending_email")).toBe(false);
  });
});

describe("the code screen says why a sign-in landed there", () => {
  const src = (path: string) => readFileSync(join(__dirname, "../..", path), "utf8");

  it("the page reads ?from=sign-in and the form draws the sentence under the title", () => {
    expect(src("app/(auth)/sign-up/verify/page.tsx")).toMatch(/fromSignIn=\{from === FROM_SIGN_IN\}/);
    const form = src("components/auth/VerifyCodeForm.tsx");
    expect(form).toMatch(/fromSignIn \? \(\s*<p[^>]*data-testid="verify-unconfirmed"[^>]*>\s*\{a\.unconfirmedOnSignIn\}/);
    /* The resend form is on the same screen, always. */
    expect(form).toContain('data-testid="verify-resend"');
  });
});

describe("every auth sentence matches what the email carries", () => {
  const en = getDictionary("en");

  it("the sign-up and sign-in email is a code with nothing to click", () => {
    const mail = verificationCode({ code: "482913", expiresInMinutes: 60 });
    expect(mail.text).toContain("482913");
    expect(mail.text).not.toMatch(/auth\/v1\/verify|auth\/callback|token_hash/);
    expect(mail.html).not.toMatch(/auth\/v1\/verify|auth\/callback|token_hash/);
  });

  it("no refusal, code screen line or reset line tells the person to open a link or tap a button from the email", () => {
    const flat = (value: unknown, prefix = "", into: [string, string][] = []): [string, string][] => {
      if (typeof value === "string") into.push([prefix, value]);
      else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) flat(child, prefix ? `${prefix}.${key}` : key, into);
      }
      return into;
    };
    const lines = [
      ...flat(en.experienceEntry.refusals, "refusals"),
      ...flat(en.authFlow, "authFlow"),
      ...flat(en.auth, "auth"),
      ...flat(en.publicDoors.emailCode, "emailCode"),
      ...flat(en.experienceRewards.inviteStep, "inviteStep"),
    ];
    const promise =
      /\b(open|tap|click|follow|use) (the|a|your) (confirmation |reset |sign-in )?(link|button)\b|link (we|that we) (sent|emailed)|carries a (button|link)|(reset|confirmation|sign-in) link is on its way|ask for a (new |reset )?link|sent you a link/i;
    for (const [key, text] of lines) expect(text, key).not.toMatch(promise);
  });

  it("the not-confirmed refusal and the reset answers name the code", () => {
    const r = en.experienceEntry.refusals;
    expect(r.unconfirmed).toMatch(/code/);
    expect(r.unconfirmed).not.toMatch(/link/i);
    expect(r.resetSent).toMatch(/reset code is on its way/);
    expect(r.resetLinkSpent).toMatch(/code/);
    expect(r.resetLinkOnly).toMatch(/code/);
    expect(en.authFlow.unconfirmedOnSignIn).toMatch(/code/);
    expect(en.authFlow.unconfirmedOnSignIn).not.toMatch(/link/i);
  });
});
