/**
 * The passcode's presentation states (docs/PASSCODE.md; the founder's
 * reference 6, the returning greeting, over his 3D passcode, reference 56):
 * the frame is always a night island, a lit scene on top with Vallo's own
 * lockup, a raised sheet holding the ring (the photo, the initial or the
 * padlock), "Hello" with the first name, "Switch account", and biometric
 * first where a passkey is enrolled; setup names its step under the title. Behaviour is covered by PasscodeGate.dom.test.tsx
 * and lib/passcode; this is only what is drawn.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";

vi.mock("@/lib/passcode/actions", () => ({
  verifyPasscodeAction: async () => ({ status: "error" }),
  setPasscodeAction: async () => ({ ok: false, reason: "error" }),
  forgotPasscodeAction: async () => undefined,
}));
vi.mock("@/lib/profile/actions", () => ({ signOut: async () => ({ ok: true, data: null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

import { PasscodeFrame, ringContent } from "./PasscodeFrame";
import { PasscodeLock } from "./PasscodeLock";
import { PasscodeSetup } from "./PasscodeSetup";

const copy = getDictionary("en").passcode;

describe("ringContent", () => {
  it("shows the photo on the lock when there is one, else the initial", () => {
    expect(ringContent("face", "https://example.test/a.jpg", true)).toBe("photo");
    expect(ringContent("face", null, true)).toBe("initial");
    expect(ringContent("face", "", true)).toBe("initial");
  });
  it("shows the padlock on setup, and the initial if the object is not ready", () => {
    expect(ringContent("lock", "https://example.test/a.jpg", true)).toBe("padlock");
    expect(ringContent("lock", null, false)).toBe("initial");
  });
});

describe("PasscodeFrame", () => {
  const draw = (overlay: boolean) =>
    renderToStaticMarkup(
      <PasscodeFrame overlay={overlay} titleId="t" title="Welcome back, Ada" subtitle="Enter your passcode" name="Ada" wordmark="VALLO">
        <span />
      </PasscodeFrame>,
    );

  it("is always a night island, as the lock and as the settings card", () => {
    expect(draw(true)).toMatch(/<dialog[^>]*data-theme="dark"/);
    expect(draw(false)).toMatch(/<section[^>]*data-theme="dark"/);
  });

  it("draws the lit scene, Vallo's own mark and wordmark, and the sheet with the ring and the initial", () => {
    const html = draw(true);
    expect(html).toContain("nf-passcode__scene");
    expect(html).toContain("villa-pool-portrait");
    expect(html).toMatch(/nf-passcode__sheet[^>]*data-door="keypad"[\s\S]*data-ring="initial"/);
    expect(html).toContain("vallo-mark.svg");
    expect(html).toContain("vallo-wordmark.svg");
    expect(html).toContain('data-ring="initial"');
    expect(html).toMatch(/nf-passcode__initial">A</);
  });
});

describe("the lock and setup screens", () => {
  it("the lock greets by first name, offers Switch account, and the keypad arrives in the sheet", () => {
    const html = renderToStaticMarkup(
      <PasscodeLock copy={copy} locale="en" mode="code" length={6} name="Ada Okafor" verify={async () => ({ status: "error" })} />,
    );
    expect(html).toContain("Hello, Ada");
    expect(html).toContain(copy.enterCode);
    expect(html).toContain('data-testid="passcode-switch-account"');
    expect(html).toContain(copy.switchAccount);
    expect(html).toContain('data-ring="initial"');
    expect(html.match(/class="nf-passcode__key(?: nf-passcode__key--quiet)?"/g)?.length).toBe(11);
  });

  it("with a passkey, the biometric is the primary and the passcode the second; the keypad waits", () => {
    const html = renderToStaticMarkup(
      <PasscodeLock copy={copy} locale="en" mode="code" length={4} name="Ada" passkey verify={async () => ({ status: "error" })} />,
    );
    expect(html).toContain("Hello, Ada");
    expect(html).toMatch(/data-door="biometric"/);
    const bio = html.indexOf('data-testid="passcode-passkey"');
    const second = html.indexOf('data-testid="passcode-use-keypad"');
    expect(bio).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(bio);
    expect(html).toContain(copy.passkeyUnlockBy["this-device"]);
    expect(html).toContain(copy.withPasscode);
    expect(html).not.toContain('data-testid="passcode-keypad"');
  });

  it("with no name the greeting stands alone", () => {
    const html = renderToStaticMarkup(
      <PasscodeLock copy={copy} locale="en" mode="code" length={4} name="" verify={async () => ({ status: "error" })} />,
    );
    expect(html).toContain(copy.helloNoName);
  });

  it("setup draws the padlock, the title and step one, with the why under the dots", () => {
    const html = renderToStaticMarkup(<PasscodeSetup copy={copy} locale="en" mode="first" name="Ada" overlay />);
    expect(html).toContain('data-ring="padlock"');
    expect(html).toContain(copy.setupTitle);
    expect(html).toContain("Step 1 of 2. Choose 4 digits.");
    expect(html).toContain(copy.setupBody);
  });

  it("the confirm step is titled and numbered as step two", () => {
    expect(copy.confirmTitle).toBe("Confirm your passcode");
    expect(copy.stepConfirm).toContain("Step 2 of 2");
  });
});
