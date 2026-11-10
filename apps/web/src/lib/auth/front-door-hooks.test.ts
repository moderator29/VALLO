import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A5 and A6 reach the sign-up path through two lines each. These pin that
 * they are wired where they have to be (the actions module is "use server"
 * and cannot be called from a unit test without Supabase).
 */
const src = (path: string) => readFileSync(join(__dirname, "../..", path), "utf8");

describe("the front door's hooks on sign up", () => {
  it("A5: sign up records the invite code the /join door left, when no code was typed", () => {
    const actions = src("lib/auth/actions.ts");
    expect(actions).toMatch(/import \{[^}]*inviteCodeFromCookie[^}]*\} from "@\/lib\/referral\/server";/);
    expect(actions).toMatch(
      /referral_code: parseInviteInput\(field\(formData, "referralCode"\)\) \|\| \(await inviteCodeFromCookie\(\)\) \|\| null/,
    );
  });

  it("A6: the resend action records the step, and the form page reports it opened", () => {
    const actions = src("lib/auth/actions.ts");
    const resend = actions.slice(actions.indexOf("export async function resendSignUpCode"));
    expect(resend.slice(0, resend.indexOf("\n}\n"))).toContain('await recordFunnelStep("code_resent");');
    expect(src("app/(auth)/sign-up/email/page.tsx")).toContain('<FunnelBeacon step="signup_opened" />');
  });
});
