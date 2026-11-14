import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));
vi.mock("@/lib/security/console-step-up", () => ({
  beginConsoleStepUp: async () => ({ state: "failed" }),
  finishConsoleStepUp: async () => ({ ok: false, error: "failed" }),
  confirmConsoleWithPassword: async () => ({ ok: false, error: "failed" }),
}));
vi.mock("@/lib/security/money-step-up-actions", () => ({
  beginEnrol: async () => ({ ok: false, error: "failed" }),
  finishEnrol: async () => ({ ok: false, error: "failed" }),
  sendFallbackCode: async () => ({ ok: false, error: "failed" }),
}));

const { ConsoleStepUp } = await import("./ConsoleStepUp");

describe("the console's door", () => {
  it("asks an admin or a staff member for their account password, and never for a key", () => {
    const html = renderToStaticMarkup(<ConsoleStepUp name="Ada" door="password" />);
    expect(html).toContain("Confirm it is you, Ada");
    expect(html).toContain("Vallo account password");
    expect(html).toContain('type="password"');
    expect(html).toContain("current-password");
    expect(html).toContain("Open the console");
    expect(html).toContain('href="/forgot-password"');
    expect(html).not.toContain("security key");
  });

  it("emails a code to an account that has no password", () => {
    const html = renderToStaticMarkup(<ConsoleStepUp name="Ada" door="email-code" />);
    expect(html).toContain("Email me a code");
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain("security key");
  });

  it("still asks a super admin for their security key", () => {
    const html = renderToStaticMarkup(<ConsoleStepUp name="Ada" door="key" />);
    expect(html).toContain("Confirm with my security key");
    expect(html).not.toContain('type="password"');
  });
});
