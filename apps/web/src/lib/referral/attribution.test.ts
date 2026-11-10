import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";
import { pathOnOurOrigin } from "@/lib/native/deep-links";
import { claimIsFinal, claimOutcome, invitePath, normaliseInviteCode } from "./code";

/**
 * D85: AN INVITE IS ATTRIBUTED, END TO END. Each hop, held:
 *
 *   1. the member's link is /join/<code> (`invitePath`), and the native app
 *      claims /join/ on both platforms, so the link opens in the web view;
 *   2. /join/<code> keeps the code in a first-party cookie and hands over to
 *      sign-up (`app/join/hand-off.ts`, its own test);
 *   3. the email sign-up writes the code into the auth metadata
 *      (`signUpWithEmail`), which the database attributes at once
 *      (`users_referral_attribute`, the pending D85 migration and its probe);
 *   4. a sign-up that carries no metadata (Google, Apple, a phone code)
 *      claims the kept code after its first session (`claimInviteFromCookie`
 *      in every action that ends with one), and `referral_claim_code`
 *      accepts it only for a new account.
 */
const WEB = process.cwd();
const read = (...parts: string[]) => withoutComments(readFileSync(join(WEB, ...parts), "utf8"));

describe("the invite link", () => {
  it("is /join/<code>, with the code normalised", () => {
    expect(invitePath("K7M2QX")).toBe("/join/K7M2QX");
    expect(normaliseInviteCode(" k7m2qx ")).toBe("K7M2QX");
    expect(normaliseInviteCode("K7M2Q0")).toBeNull();
  });

  it("opens in the app's web view on both platforms", () => {
    const aasa = JSON.parse(readFileSync(join(WEB, "public", ".well-known", "apple-app-site-association"), "utf8")) as {
      applinks: { details: { components: { "/": string; exclude?: boolean }[] }[] };
    };
    const components = aasa.applinks.details.flatMap((d) => d.components);
    expect(components.some((c) => c["/"] === "/join/*" && !c.exclude)).toBe(true);
    const manifest = readFileSync(join(WEB, "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
    expect(manifest).toContain('<data android:pathPrefix="/join/" />');
    expect(pathOnOurOrigin("https://www.vallospaces.com/join/K7M2QX", "https://www.vallospaces.com")).toBe("/join/K7M2QX");
  });
});

describe("the sign-up records it", () => {
  it("writes the kept code into the email sign-up's metadata", () => {
    expect(read("src", "lib", "auth", "actions.ts")).toMatch(/referral_code:\s*parseInviteInput\(field\(formData, "referralCode"\)\) \|\| \(await inviteCodeFromCookie\(\)\)/);
  });

  it("claims it after every sign-in that can make a new account", () => {
    const actions = read("src", "lib", "auth", "actions.ts");
    for (const fn of ["completeEmailVerification", "signInWithAppleIdToken", "finishSocialSetup"]) {
      const start = actions.indexOf(`export async function ${fn}`);
      expect(start, fn).toBeGreaterThan(-1);
      const next = actions.indexOf("\nexport async function ", start + 10);
      expect(actions.slice(start, next === -1 ? undefined : next), fn).toContain("await claimInviteFromCookie()");
    }
    expect(read("src", "lib", "auth", "phone-sign-in.ts")).toContain("await claimInviteFromCookie()");
  });

  it("keeps the code until the claim has a final answer", () => {
    expect(claimOutcome("attributed")).toBe("attributed");
    expect(claimOutcome("whatever")).toBeNull();
    expect(claimIsFinal("attributed")).toBe(true);
    expect(claimIsFinal("already_attributed")).toBe(true);
    expect(claimIsFinal("too_late")).toBe(true);
    expect(claimIsFinal("own_code")).toBe(true);
    expect(claimIsFinal("signed_out")).toBe(false);
  });
});
