import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import { ReferralField } from "./ReferralField";

afterAll(closeAxe);
const t = getDictionary("en");
const check = async () => ({ state: "empty" as const });

describe("ReferralField", () => {
  it("is optional, takes a code or a link, and shows no reward", () => {
    const html = renderToStaticMarkup(<ReferralField t={t} check={check} />);
    expect(html).toContain(t.signUp.referralInviteLabel);
    expect(html).toContain(t.signUp.optional);
    expect(html).toContain(t.signUp.referralInviteHint);
    expect(html).not.toMatch(/₦|reward|earn/i);
  });
  it("confirms an invite link that brought the person here: Referred by X", () => {
    const html = renderToStaticMarkup(<ReferralField t={t} check={check} initialCode="ABC234" initialName="Ada" />);
    expect(html).toContain("Referred by Ada");
    expect(html).toContain('value="ABC234"');
    expect(html).toContain('data-state="found"');
  });
  it("passes axe", async () => {
    if (!hasBrowser) return;
    const html = renderToStaticMarkup(<ReferralField t={t} check={check} initialCode="ABC234" initialName="Ada" />);
    expect(await axe(`<h1>Sign up</h1><form>${html}</form>`)).toEqual([]);
  });
});
