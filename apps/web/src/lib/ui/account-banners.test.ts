import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { DONE_FLAGS, GLOBAL_DONE_FLAGS, isGlobalDoneFlag, successCopy } from "./success-moments";
import { clientCopyOf } from "@/lib/i18n/client-copy-of";

/**
 * THE WHOLE AUTH LIFECYCLE SPEAKS IN THE TOP BANNER. Each moment is an account
 * flag (never in the address, carried by the server's one-shot cookie
 * `rememberSuccess` across a redirect, or `showSuccess` on the client) with
 * words in the dictionary and in the slice every screen carries.
 */
const LIFECYCLE: Record<string, string> = {
  "account-created": "Welcome to Vallo",
  "check-email": "Check your email",
  "signed-in": "Signed in. Welcome back.",
  "signed-out": "You are signed out",
  "password-changed": "Password changed",
  "email-verified": "Email confirmed",
  "profile-confirmed": "Thanks, your profile is confirmed.",
  "photo-added": "Your photo is added",
};

describe("the auth lifecycle banners", () => {
  const copy = clientCopyOf(getDictionary("en")).success;

  it("has a global flag and the right words for every step", () => {
    for (const [flag, title] of Object.entries(LIFECYCLE)) {
      expect(isGlobalDoneFlag(flag), flag).toBe(true);
      expect(GLOBAL_DONE_FLAGS).toContain(flag);
      const words = successCopy(copy, DONE_FLAGS[flag as keyof typeof DONE_FLAGS] as never);
      expect(words.title, flag).toBe(title);
      expect(words.title + words.body).not.toMatch(/—|–/);
    }
  });

  it("never makes a record flag global by accident", () => {
    expect(isGlobalDoneFlag("claim-filed")).toBe(false);
    expect(isGlobalDoneFlag("nope")).toBe(false);
  });
});

describe("signing out leaves the banner flag", () => {
  it("sets signed-out after the session ends, and a cookie fault never undoes the sign out", async () => {
    vi.resetModules();
    const remember = vi.fn().mockRejectedValue(new Error("no request"));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("../push/revoke", () => ({ isDeviceRef: () => false, revokeTokens: vi.fn() }));
    vi.doMock("../ui/success-cookie", () => ({ rememberSuccess: remember }));
    vi.doMock("../actions/session", () => ({
      NOT_CONFIGURED_MESSAGE: "n",
      SIGNED_OUT_MESSAGE: "s",
      resolveSession: async () => ({ state: "signed-in", user: { id: "u" }, supabase: { auth: { signOut: async () => ({ error: null }) } } }),
    }));
    const { signOut } = await import("@/lib/profile/actions");
    const result = await signOut();
    expect(result.ok).toBe(true);
    expect(remember).toHaveBeenCalledWith("signed-out");
    vi.doUnmock("../ui/success-cookie");
  });
});
