import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SEC-04: attaching a host or venue photograph strips its metadata on the
 * server FIRST, and a photograph that cannot be made safe is never recorded
 * (the row is what makes a public object appear on a page).
 */
const USER = "957b3bd2-cce3-425d-bba9-5cd876ca3d62";
const BUSINESS = "0f3b2a4e-8a1c-4d7e-9b2a-1c2d3e4f5a6b";

const seam = vi.hoisted(() => ({ scrub: vi.fn(), insert: vi.fn(), order: [] as string[] }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
/* The action builds its field schema in the request's language (`hostRefusals`); a test has no request. */
vi.mock("../locale", () => ({ getLocale: async () => "en" }));
vi.mock("../images/scrub", () => ({
  SCRUB_REFUSED_MESSAGE: "refused: not safe to publish",
  scrubPublicPhoto: async (bucket: string, path: string) => {
    seam.order.push("scrub");
    return seam.scrub(bucket, path);
  },
}));

function table(name: string) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "maybeSingle", "single"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: unknown) => void) =>
    resolve(name === "businesses" ? { data: { id: BUSINESS }, error: null } : { data: [], error: null });
  chain.maybeSingle = async () => ({ data: { id: BUSINESS }, error: null });
  chain.insert = (row: unknown) => {
    seam.order.push("insert");
    seam.insert(row);
    return { select: () => ({ single: async () => ({ data: { id: "p1" }, error: null }) }) };
  };
  return chain;
}

vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({ state: "signed-in", user: { id: USER }, supabase: { from: table } }),
}));

beforeEach(() => {
  seam.scrub.mockReset();
  seam.insert.mockReset();
  seam.order = [];
});

describe("attaching a venue photograph", () => {
  const input = { businessId: BUSINESS, storagePath: `${USER}/${BUSINESS}/a.jpg` };

  it("scrubs the stored object in the public bucket before the row is written", async () => {
    seam.scrub.mockResolvedValue({ ok: true, changed: true });
    const { addBusinessPhoto } = await import("./actions");
    const result = await addBusinessPhoto(input);
    expect(result.ok).toBe(true);
    expect(seam.scrub).toHaveBeenCalledWith("accommodation-photos", input.storagePath);
    expect(seam.order).toEqual(["scrub", "insert"]);
  });

  it("records nothing when the photograph could not be scrubbed", async () => {
    seam.scrub.mockResolvedValue({ ok: false, reason: "unsupported-format" });
    const { addBusinessPhoto } = await import("./actions");
    const result = await addBusinessPhoto(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("refused: not safe to publish");
    expect(seam.insert).not.toHaveBeenCalled();
  });
});

describe("attaching a photograph of a room type", () => {
  const ROOM = "6a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
  const input = { roomTypeId: ROOM, storagePath: `${USER}/${ROOM}/a.jpg` };

  it("scrubs the stored object in the public bucket before the row is written", async () => {
    seam.scrub.mockResolvedValue({ ok: true, changed: true });
    const { addRoomTypePhoto } = await import("./actions");
    const result = await addRoomTypePhoto(input);
    expect(result.ok).toBe(true);
    expect(seam.scrub).toHaveBeenCalledWith("accommodation-photos", input.storagePath);
    expect(seam.order).toEqual(["scrub", "insert"]);
    expect(seam.insert).toHaveBeenCalledWith({ room_type_id: ROOM, storage_path: input.storagePath, position: 0 });
  });

  it("records nothing when the photograph could not be scrubbed", async () => {
    seam.scrub.mockResolvedValue({ ok: false, reason: "unsupported-format" });
    const { addRoomTypePhoto } = await import("./actions");
    const result = await addRoomTypePhoto(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("refused: not safe to publish");
    expect(seam.insert).not.toHaveBeenCalled();
  });

  it("refuses a path outside the caller's own folder before anything is scrubbed", async () => {
    const { addRoomTypePhoto } = await import("./actions");
    const result = await addRoomTypePhoto({ roomTypeId: ROOM, storagePath: `someone-else/${ROOM}/a.jpg` });
    expect(result.ok).toBe(false);
    expect(seam.scrub).not.toHaveBeenCalled();
    expect(seam.insert).not.toHaveBeenCalled();
  });
});
