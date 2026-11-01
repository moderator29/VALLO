import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({
  can: false as unknown,
  upserts: [] as Record<string, unknown>[],
  signedIn: true,
}));

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>("@/lib/security/rate-limit");
  return { ...actual, consume: async () => ({ allowed: true, degraded: false }) };
});
vi.mock("@/lib/listings/repository", () => ({
  getListingRepository: () => ({
    byId: async (id: string) => ({ id, title: "Secret words", address: "12 Private Road", kind: "apartment", area: "Yaba", city: "Lagos", bedrooms: 2, priceMinor: 2_000_000_00, isDemo: false }),
  }),
}));
vi.mock("@/lib/actions/session", () => ({
  resolveSession: async () =>
    seam.signedIn
      ? {
          state: "signed-in",
          user: { id: "u1" },
          supabase: {
            rpc: async () => ({ data: seam.can, error: null }),
            from: () => ({
              select: () => ({ eq: () => ({ like: async () => ({ data: [], error: null }) }) }),
              upsert: async (row: Record<string, unknown>) => {
                seam.upserts.push(row);
                return { error: null };
              },
            }),
          },
        }
      : { state: "signed-out" },
}));

const { recordAssistantOpen } = await import("./activity-actions");
const LID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  seam.can = false;
  seam.upserts = [];
  seam.signedIn = true;
});

describe("recording what a member opened", () => {
  it("writes nothing when the assistant is off or Saved preferences are not granted", async () => {
    expect(await recordAssistantOpen({ listingId: LID })).toEqual({ recorded: false });
    expect(seam.upserts).toEqual([]);
  });

  it("writes nothing for a signed-out visitor", async () => {
    seam.signedIn = false;
    seam.can = true;
    expect(await recordAssistantOpen({ listingId: LID })).toEqual({ recorded: false });
    expect(seam.upserts).toEqual([]);
  });

  it("with the permission, writes only kind, area, bedrooms and band, as activity, for the caller", async () => {
    seam.can = true;
    expect(await recordAssistantOpen({ listingId: LID })).toEqual({ recorded: true });
    expect(seam.upserts.map((u) => u.key)).toEqual(["seen:area:yaba", "seen:kind:apartment", "seen:bedrooms:2", "seen:band:1m-3m"]);
    for (const u of seam.upserts) {
      expect(u.user_id).toBe("u1");
      expect(u.source).toBe("activity");
    }
    expect(JSON.stringify(seam.upserts)).not.toMatch(/Secret words|Private Road|11111111/);
  });
});
