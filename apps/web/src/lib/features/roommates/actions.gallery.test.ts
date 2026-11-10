import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ session: {} as Record<string, unknown>, allowed: true, update: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/actions/session", () => ({ NOT_CONFIGURED_MESSAGE: "nc", SIGNED_OUT_MESSAGE: "signed out", resolveSession: async () => seam.session }));
vi.mock("@/lib/security/rate-limit", () => ({ subjectForUser: (i: string) => i, consume: async () => (seam.allowed ? { allowed: true } : { allowed: false, retryIn: "in a minute" }) }));
vi.mock("@/lib/email/client", () => ({ sendEmail: async () => undefined }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/funnel/roommates", () => ({ recordRoommatesStep: async () => undefined }));
vi.mock("./queries", () => ({ searchRooms: vi.fn(), discoverPeople: vi.fn() }));

const U = "957b3bd2-cce3-425d-bba9-5cd876ca3d62";
const db = (rows: unknown[] | null, error: unknown = null) => ({
  from: () => ({ update: (v: unknown) => (seam.update(v), { eq: () => ({ select: async () => ({ data: rows, error }) }) }) }),
});

beforeEach(() => {
  seam.allowed = true;
  seam.update.mockReset();
  seam.session = { state: "signed-in", supabase: db([{ user_id: U }]), user: { id: U } };
});

describe("setRoommateGallery", () => {
  it("saves the member's own photos", async () => {
    const { setRoommateGallery } = await import("./actions");
    const r = await setRoommateGallery([`${U}/a.jpg`, `${U}/b.jpg`]);
    expect(r.ok && r.data.gallery).toEqual([`${U}/a.jpg`, `${U}/b.jpg`]);
    expect(seam.update).toHaveBeenCalledWith({ gallery: [`${U}/a.jpg`, `${U}/b.jpg`] });
  });
  it("refuses another member's photo, a seventh photo and a signed-out caller, before any write", async () => {
    const { setRoommateGallery } = await import("./actions");
    expect((await setRoommateGallery(["other/a.jpg"])).ok).toBe(false);
    expect((await setRoommateGallery(Array.from({ length: 7 }, (_, i) => `${U}/${i}.jpg`))).ok).toBe(false);
    seam.session = { state: "signed-out" };
    expect((await setRoommateGallery([])).ok).toBe(false);
    expect(seam.update).not.toHaveBeenCalled();
  });
  it("says to make the profile first when no row changed, and is paced", async () => {
    const { setRoommateGallery } = await import("./actions");
    seam.session = { state: "signed-in", supabase: db([]), user: { id: U } };
    const none = await setRoommateGallery([]);
    expect(!none.ok && none.error).toContain("Make your roommate profile first");
    seam.allowed = false;
    expect((await setRoommateGallery([])).ok).toBe(false);
  });
});

describe("roommates_9 SQL", () => {
  const sql = readFileSync(join(process.cwd(), "../../supabase/migrations/pending/roommates_9_profile_gallery_2026-11-10.sql"), "utf8");
  it("is additive, repeatable, capped at six and keeps paths in the member's folder", () => {
    expect(sql).toContain("add column if not exists gallery text[] not null default '{}'");
    expect(sql).toContain("cardinality(gallery) <= 6");
    expect(sql).toContain("RM301");
    expect(sql).not.toMatch(/drop table|drop column|grant (select|insert|update)/i);
    expect(sql).not.toContain("—");
  });
});
