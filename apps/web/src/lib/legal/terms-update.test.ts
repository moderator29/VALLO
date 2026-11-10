import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const { updateOwed } = await import("./terms-update");
const { TERMS_VERSION } = await import("./versions");

describe("the new-terms notice is owed", () => {
  it("to a member who agreed to an earlier version and not to today's", () => {
    expect(updateOwed(["2026-11-03"], "2026-11-09")).toBe(true);
  });

  it("never twice: not once today's version is on record", () => {
    expect(updateOwed(["2026-11-03", "2026-11-09"], "2026-11-09")).toBe(false);
  });

  it("never to a new member, who accepted today's version at sign up", () => {
    expect(updateOwed([TERMS_VERSION])).toBe(false);
  });

  it("not by this notice to an account with no terms row at all (finish-setup owns that)", () => {
    expect(updateOwed([])).toBe(false);
  });
});
