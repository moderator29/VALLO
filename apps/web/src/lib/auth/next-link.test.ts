import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { destinationOf, withNext } from "./next-link";

/**
 * UX-02: every door to account creation carried people to a bare /sign-up,
 * and the email link hard-coded /home, so a new person who arrived on a
 * shared listing landed on Home. The doors now keep `next`.
 */
describe("auth doors keep where the person was going", () => {
  it("carries a safe path and drops anything that could leave the site", () => {
    expect(withNext("/sign-up", "/listing/abc")).toBe("/sign-up?next=%2Flisting%2Fabc");
    expect(withNext("/sign-up", undefined)).toBe("/sign-up");
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example"]) {
      expect(withNext("/sign-up", evil)).toBe("/sign-up");
    }
  });

  it("finds the destination inside a gate's address", () => {
    expect(destinationOf("/sign-in?next=%2Fsearch%3Fq%3Dlekki&notice=sign-in-required")).toBe("/search?q=lekki");
    expect(destinationOf("/sign-in")).toBeNull();
    expect(destinationOf("/listing/abc")).toBe("/listing/abc");
    expect(destinationOf("/sign-in?next=https%3A%2F%2Fevil.example")).toBeNull();
  });

  it("is wired into every door: the swap links, first run, and the email link", () => {
    const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");
    for (const file of ["components/auth/AuthChoices.tsx", "components/auth/EmailAuthForm.tsx"]) {
      const text = src(file);
      expect(text, file).not.toMatch(/href=\{isSignUp \? "\/sign-(?:in|up)" : "\/sign-(?:in|up)"\}/);
      expect(text, file).toContain("withNext(isSignUp ?");
    }
    expect(src("components/auth/AuthChoices.tsx")).toContain('encodeURIComponent(withNext("/sign-up", next))');
    expect(src("components/app/welcome/FirstRun.tsx")).toContain('withNext("/sign-up", destinationOf(next))');
    const actions = src("lib/auth/actions.ts");
    expect(actions).not.toContain('callback?next=${encodeURIComponent("/home")}');
    /* The sign-up itself, and the resend through the one metered helper
       (`sendSignUpCode`, shared with a sign-in refused as not confirmed). */
    expect(actions.match(/callback\?next=\$\{encodeURIComponent\(landingAfterAuth\(formData\)\)\}/g)?.length).toBe(1);
    expect(actions).toContain("sendSignUpCode(email, landingAfterAuth(formData))");
    expect(actions).toContain("callback?next=${encodeURIComponent(landing)}");
    expect(src("components/auth/VerifyCodeForm.tsx")).toMatch(/resendAction[\s\S]{0,200}name="next"/);
  });
});
