/**
 * The gate in the (app) layout (docs/PASSCODE.md), rendered for real: which
 * layer it draws for each server decision, and that a locked or unset
 * session never gets the page's markup at all. The decision itself is
 * `lib/passcode/decide.test.ts`; this is the wiring from it to the screen.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import type { GateView } from "@/lib/passcode/decide";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";

const s = vi.hoisted(() => ({ view: { kind: "open" } as GateView }));

vi.mock("@/lib/passcode/state", () => ({
  resolvePasscodeGate: async () => ({ view: s.view, userId: "user-1", unlock: null }),
}));
vi.mock("@/lib/passcode/actions", () => ({
  verifyPasscodeAction: async () => ({ status: "error" }),
  setPasscodeAction: async () => ({ ok: false, reason: "error" }),
  lockPasscodeAction: async () => undefined,
  forgotPasscodeAction: async () => undefined,
}));
vi.mock("@/lib/profile/actions", () => ({ signOut: async () => ({ ok: true, data: null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

import { PasscodeGate } from "./PasscodeGate";

afterAll(closeAxe);

const t = getDictionary("en");
const PAGE = <main data-testid="the-page">Secret page content</main>;

async function draw(view: GateView): Promise<string> {
  s.view = view;
  const element = await PasscodeGate({ t, locale: "en", name: "Ada", avatarUrl: "", children: PAGE });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  s.view = { kind: "open" };
});

describe("PasscodeGate", () => {
  it("draws the page untouched for a signed-out visitor", async () => {
    const html = await draw({ kind: "open" });
    expect(html).toContain("Secret page content");
    expect(html).not.toContain("passcode");
  });

  it("draws the page inside the inactivity guard when unlocked", async () => {
    const html = await draw({ kind: "unlocked", mint: false, length: 6 });
    expect(html).toContain("Secret page content");
    expect(html).not.toContain('data-testid="passcode-lock"');
  });

  it("draws the lock INSTEAD of the page when locked: Hello, the dots, the keypad, the password way out", async () => {
    const html = await draw({ kind: "locked", mode: "code", length: 6, failedCount: 0, lockedUntil: null });
    expect(html).not.toContain("Secret page content");
    expect(html).toContain('data-testid="passcode-lock"');
    expect(html).toContain("Hello, Ada");
    expect(html.match(/nf-passcode__dot(?!s)/g)?.length).toBe(6);
    expect(html.match(/class="nf-passcode__key(?: nf-passcode__key--quiet)?"/g)?.length).toBe(11);
    expect(html).toContain(t.passcode.usePassword);
    expect(html).toMatch(/<dialog[^>]*open/);
  });

  it("draws four dots for a four-digit code", async () => {
    const html = await draw({ kind: "locked", mode: "code", length: 4, failedCount: 0, lockedUntil: null });
    expect(html.match(/nf-passcode__dot(?!s)/g)?.length).toBe(4);
  });

  it("offers only a full sign-in after ten wrong tries", async () => {
    const html = await draw({ kind: "locked", mode: "password-only", length: 6, failedCount: 10, lockedUntil: null });
    expect(html).not.toContain("Secret page content");
    expect(html).not.toContain('data-testid="passcode-keypad"');
    expect(html).toContain(t.passcode.signInAgain);
  });

  it("shows the lock, not the page, when the passcode could not be read", async () => {
    const html = await draw({ kind: "locked", mode: "unavailable", length: 6, failedCount: 0, lockedUntil: null });
    expect(html).not.toContain("Secret page content");
    expect(html).toContain(t.passcode.unavailable);
    expect(html).toContain(t.passcode.usePassword);
  });

  it("draws the page, untouched, for a member with no passcode (optional since 6 November 2026)", async () => {
    const html = await draw({ kind: "unset" });
    expect(html).toContain("Secret page content");
    expect(html).not.toContain('data-testid="passcode-setup-enter"');
    expect(html).not.toContain('data-testid="passcode-lock"');
  });

  it("still draws the first-code setup when asked for it, four digits by default", async () => {
    const html = await draw({ kind: "setup", mode: "first" });
    expect(html).not.toContain("Secret page content");
    expect(html).toContain('data-testid="passcode-setup-enter"');
    expect(html).toContain(t.passcode.setupTitle);
    expect(html.match(/nf-passcode__dot(?!s)/g)?.length).toBe(4);
    expect(html).toContain(t.passcode.useSix);
  });

  it("draws the reset flavour after a fresh sign-in", async () => {
    const html = await draw({ kind: "setup", mode: "reset" });
    expect(html).toContain(t.passcode.resetTitle);
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the lock and setup screens (axe)", () => {
  it("have no axe violations", async () => {
    for (const view of [
      { kind: "locked", mode: "code", length: 6, failedCount: 0, lockedUntil: null } as GateView,
      { kind: "setup", mode: "first" } as GateView,
    ]) {
      expect(await axe(await draw(view))).toEqual([]);
    }
  });
});
