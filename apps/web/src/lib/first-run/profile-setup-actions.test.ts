import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({
  update: vi.fn(),
  mark: vi.fn(),
  jar: new Map<string, { value: string; opts: Record<string, unknown> }>(),
  signedIn: true,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: (k: string, v: string, o: Record<string, unknown>) => seam.jar.set(k, { value: v, opts: o }) }),
}));
vi.mock("@/lib/actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () =>
    seam.signedIn
      ? {
          state: "signed-in",
          user: { id: "u1" },
          supabase: {
            from: () => ({
              update: (patch: unknown) => ({
                eq: () => ({ select: () => ({ maybeSingle: () => seam.update(patch) }) }),
              }),
            }),
          },
        }
      : { state: "signed-out" },
}));
vi.mock("./store", () => ({ markFirstRunSeen: seam.mark }));

import { confirmProfileName, markProfileSetupShown, skipProfileSetup } from "./profile-setup-actions";

beforeEach(() => {
  seam.update.mockReset();
  seam.update.mockResolvedValue({ data: { first_name: "Ada" }, error: null });
  seam.mark.mockReset();
  seam.jar.clear();
  seam.signedIn = true;
});

describe("confirmProfileName", () => {
  it("saves first name and surname and records the confirmation", async () => {
    const result = await confirmProfileName({ fullName: " Ada  Okafor " });
    expect(result).toEqual({ ok: true, data: { firstName: "Ada" } });
    expect(seam.update).toHaveBeenCalledWith({ first_name: "Ada", surname: "Okafor" });
    expect(seam.mark).toHaveBeenCalledWith("name-confirmed");
  });
  it("refuses one word, with the field's own message, and writes nothing", async () => {
    const result = await confirmProfileName({ fullName: "PHANTOM" });
    expect(result.ok).toBe(false);
    expect(seam.update).not.toHaveBeenCalled();
    expect(seam.mark).not.toHaveBeenCalled();
  });
  it("does not record a confirmation the database refused", async () => {
    seam.update.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await confirmProfileName({ fullName: "Ada Okafor" });
    expect(result.ok).toBe(false);
    expect(seam.mark).not.toHaveBeenCalled();
  });
  it("refuses a signed-out caller", async () => {
    seam.signedIn = false;
    expect((await confirmProfileName({ fullName: "Ada Okafor" })).ok).toBe(false);
    expect(seam.update).not.toHaveBeenCalled();
  });
});

describe("the nag limits", () => {
  it("marks the session as shown with a session cookie", async () => {
    await markProfileSetupShown();
    const c = seam.jar.get("vallo_setup_shown");
    expect(c?.value).toBe("1");
    expect(c?.opts.maxAge).toBeUndefined();
    expect(c?.opts.httpOnly).toBe(true);
  });
  it("a skip writes the time with a long-lived server-only cookie", async () => {
    await skipProfileSetup();
    const c = seam.jar.get("vallo_setup_skip");
    expect(Number(c?.value)).toBeGreaterThan(1_700_000_000_000);
    expect(c?.opts.httpOnly).toBe(true);
    expect(Number(c?.opts.maxAge)).toBeGreaterThan(3 * 24 * 3600);
  });
});
