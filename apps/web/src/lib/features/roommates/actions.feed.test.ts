import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({
  session: { state: "signed-out" } as Record<string, unknown>,
  allowed: true,
  rooms: vi.fn(),
  people: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => seam.session,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  subjectForUser: (id: string) => `user:${id}`,
  consume: async () => (seam.allowed ? { allowed: true } : { allowed: false, retryIn: "in a minute" }),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: async () => undefined }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/funnel/roommates", () => ({ recordRoommatesStep: async () => undefined }));
vi.mock("./queries", () => ({ searchRooms: seam.rooms, discoverPeople: seam.people }));

const U = "957b3bd2-cce3-425d-bba9-5cd876ca3d62";
const filters = { q: "", stateCode: null, city: null, minNaira: null, maxNaira: null, genderPref: null, roomType: null, moveBy: null };

beforeEach(() => {
  seam.session = { state: "signed-in", supabase: {}, user: { id: U } };
  seam.allowed = true;
  seam.rooms.mockReset().mockResolvedValue({ state: "ok", items: [{ id: "r1" }], next: 20 });
  seam.people.mockReset().mockResolvedValue({ state: "ok", items: [{ userId: "p1" }], next: null });
});

describe("loadRoommatesFeed", () => {
  it("refuses an input that does not fit, before any read", async () => {
    const { loadRoommatesFeed } = await import("./actions");
    const r = await loadRoommatesFeed({ tab: "nope" as never, filters, cursor: { rooms: 0, people: 0 } });
    expect(r.ok).toBe(false);
    expect(seam.rooms).not.toHaveBeenCalled();
  });

  it("offering reads only rooms, for both kinds of home post, and keeps the cursor", async () => {
    const { loadRoommatesFeed } = await import("./actions");
    const r = await loadRoommatesFeed({ tab: "offering", filters, cursor: { rooms: 0, people: null } });
    expect(r.ok).toBe(true);
    expect(seam.people).not.toHaveBeenCalled();
    expect(seam.rooms.mock.calls[0]![0].kinds).toEqual(["room_offer", "roommate_wanted"]);
    if (r.ok) expect(r.data.next).toEqual({ rooms: 20, people: null });
  });

  it("all weaves rooms and people, and ends when both reads are done", async () => {
    seam.rooms.mockResolvedValue({ state: "ok", items: [{ id: "r1" }], next: null });
    const { loadRoommatesFeed } = await import("./actions");
    const r = await loadRoommatesFeed({ tab: "all", filters, cursor: { rooms: 0, people: 0 } });
    expect(r.ok && r.data.items.map((i) => i.type)).toEqual(["room", "person"]);
    expect(r.ok && r.data.next).toBeNull();
  });

  it("says so when the reader has no profile yet, and still returns the rooms", async () => {
    seam.people.mockResolvedValue({ state: "need-profile" });
    const { loadRoommatesFeed } = await import("./actions");
    const r = await loadRoommatesFeed({ tab: "all", filters, cursor: { rooms: 0, people: 0 } });
    expect(r.ok && r.data.peopleNote).toBe("need-profile");
    expect(r.ok && r.data.items).toHaveLength(1);
  });

  it("says not open when the rooms read is not live, and is paced", async () => {
    seam.rooms.mockResolvedValue({ state: "not-open" });
    const { loadRoommatesFeed } = await import("./actions");
    const a = await loadRoommatesFeed({ tab: "all", filters, cursor: { rooms: 0, people: 0 } });
    expect(a.ok).toBe(false);
    seam.allowed = false;
    const b = await loadRoommatesFeed({ tab: "all", filters, cursor: { rooms: 0, people: 0 } });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error).toContain("try again in a minute");
  });
});

describe("expressInterest", () => {
  const db = (status: string) => ({
    rpc: async () => ({ data: "i1", error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status } }) }) }) }),
  });
  it("says whether the yes connected the two people", async () => {
    const { expressInterest } = await import("./actions");
    seam.session = { state: "signed-in", supabase: db("accepted"), user: { id: U } };
    const a = await expressInterest({ toId: "11111111-1111-4111-8111-111111111111" });
    expect(a.ok && a.data).toEqual({ id: "i1", connected: true });
    seam.session = { state: "signed-in", supabase: db("pending"), user: { id: U } };
    const b = await expressInterest({ toId: "11111111-1111-4111-8111-111111111111" });
    expect(b.ok && b.data.connected).toBe(false);
  });
  it("refuses yourself and a bad id", async () => {
    const { expressInterest } = await import("./actions");
    expect((await expressInterest({ toId: U })).ok).toBe(false);
    expect((await expressInterest({ toId: "x" })).ok).toBe(false);
  });
});
