import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import { ownerRegistrationSchema } from "@/lib/supply/registration";
import { WorkspaceAcceptance } from "./WorkspaceAcceptance";

afterAll(closeAxe);

const copy = getDictionary("en").payChoice;
const noop = () => undefined;
const html = (over: Partial<Parameters<typeof WorkspaceAcceptance>[0]> = {}) =>
  renderToStaticMarkup(<WorkspaceAcceptance copy={copy} terms={false} pay={false} onTerms={noop} onPay={noop} {...over} />);
const words = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/* Founder ruling 6 (13 October 2026): the two ticks before any workspace
   application or setup is sent. */
describe("the two ticks", () => {
  it("says both sentences, the founder's words exactly, unticked until ticked", () => {
    const out = html();
    const text = words(out);
    expect(text).toContain("I have read and accept the Terms of Service");
    expect(text).toContain("and the Privacy Policy");
    expect(text).toContain("Every payment for a deal I make on Vallo happens inside Vallo.");
    expect(out).not.toContain("checked");
  });

  it("opens the Terms and the Privacy Policy in a new tab, so the form is not lost", () => {
    const out = html();
    for (const href of ["/terms", "/privacy"]) {
      const link = out.match(new RegExp(`<a[^>]*href="${href}"[^>]*>`))?.[0] ?? "";
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener"');
    }
  });

  it("says what is missing once a send was refused", () => {
    expect(words(html({ showError: true }))).toContain(copy.accept.required);
    expect(words(html({ showError: true, terms: true, pay: true }))).not.toContain(copy.accept.required);
  });

  it("draws only the pay-on-Vallo tick where the Terms are asked in other words (the host wizard)", () => {
    const out = html({ showTerms: false });
    expect(out).not.toContain('name="acceptTerms"');
    expect(out).toContain('name="acceptPayOnVallo"');
  });
});

describe("the server refuses without them, not only the form", () => {
  const owner = {
    role: "owner",
    fullName: "Test Owner",
    phone: "08031234567",
    nin: "12345678901",
    stateCode: "LA",
    lgaCode: "LA-ETI",
    area: "",
    ownershipDocument: "none",
  };
  it("refuses a registration without both, names the field, and passes with both", () => {
    const none = ownerRegistrationSchema.safeParse(owner);
    expect(none.success).toBe(false);
    const paths = none.success ? [] : none.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["acceptTerms", "acceptPayOnVallo"]));
    expect(ownerRegistrationSchema.safeParse({ ...owner, acceptTerms: true, acceptPayOnVallo: "yes" }).success).toBe(false);
    expect(ownerRegistrationSchema.safeParse({ ...owner, acceptTerms: true, acceptPayOnVallo: true }).success).toBe(true);
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the two ticks (axe)", () => {
  it("has no axe violations", async () => {
    expect(await axe(`<h1>Register</h1>${html()}`)).toEqual([]);
  });
});
