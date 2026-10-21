import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deleting a draft that carries records somebody else holds (a booking, or a
 * table request with its conversation) is refused by the database with
 * 23503. The agent is told why the draft stays, not to try again.
 */

const state = vi.hoisted(() => ({
  deleteError: null as null | { code: string; message: string },
  removed: [] as { bucket: string; paths: string[] }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../flags", () => ({ isFeatureEnabled: async () => true }));
vi.mock("../images/scrub", () => ({ SCRUB_REFUSED_MESSAGE: "scrub refused", scrubPublicPhoto: vi.fn() }));

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const step of ["select", "eq", "in", "order", "limit"]) c[step] = () => c;
  c.maybeSingle = async () => ({ data: result, error: null });
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: result, error: null }).then(resolve);
  return c;
}

const LISTING_ID = "3b0f1b0e-6f5a-4d1e-9b77-1c2d3e4f5a6b";

vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "unconfigured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: "user-1" },
    supabase: {
      from: (table: string) => {
        if (table === "agents") return chain({ id: "agent-1" });
        if (table === "listing_photos") return chain([{ storage_path: "user-1/l/photo.jpg" }]);
        if (table === "listing_videos") return chain([{ storage_path: "user-1/l/walk.mp4", poster_path: "user-1/l/still.jpg" }]);
        if (table === "listings") {
          const c = chain({ id: LISTING_ID, status: "DRAFT" });
          c.delete = () => ({
            eq: () => ({ eq: async () => ({ error: state.deleteError }) }),
          });
          return c;
        }
        return chain(null);
      },
      storage: {
        from: (bucket: string) => ({
          remove: async (paths: string[]) => {
            state.removed.push({ bucket, paths });
            return {};
          },
        }),
      },
    },
  }),
}));

const { deleteListing } = await import("./listings-actions");

beforeEach(() => {
  state.deleteError = null;
  state.removed = [];
});

describe("deleting a draft listing", () => {
  it("deletes a draft with nothing on record, and its photos, stills and walkthroughs with it", async () => {
    expect(await deleteListing({ listingId: LISTING_ID })).toEqual({ ok: true, data: null });
    expect(state.removed).toEqual([
      { bucket: "listing-photos", paths: ["user-1/l/photo.jpg", "user-1/l/still.jpg"] },
      { bucket: "listing-videos", paths: ["user-1/l/walk.mp4"] },
    ]);
  });

  it("removes nothing from storage when the draft is kept", async () => {
    state.deleteError = { code: "23503", message: "violates foreign key constraint" };
    await deleteListing({ listingId: LISTING_ID });
    expect(state.removed).toEqual([]);
  });

  it("keeps a draft whose bookings or table requests are on record, and says why", async () => {
    state.deleteError = { code: "23503", message: "violates foreign key constraint" };
    const result = await deleteListing({ listingId: LISTING_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/kept rather than deleted/);
    expect(result.error).not.toMatch(/try again/i);
  });

  it("asks for a retry only when the failure is not a record being kept", async () => {
    state.deleteError = { code: "57014", message: "canceling statement due to statement timeout" };
    const result = await deleteListing({ listingId: LISTING_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/try again/i);
  });
});
