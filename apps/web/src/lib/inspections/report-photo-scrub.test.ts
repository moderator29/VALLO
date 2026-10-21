import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An inspection report photo loses its metadata (GPS above all) on the server
 * before any row points at it, and the service-role scrub only runs for a
 * caller who is a party to the inspection.
 */

const session = vi.hoisted(() => ({ resolveSession: vi.fn() }));
const scrub = vi.hoisted(() => ({ scrubPublicPhoto: vi.fn() }));
vi.mock("../actions/session", () => session);
vi.mock("../images/scrub", () => scrub);
vi.mock("../messages/actions", () => ({ startConversation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("server-only", () => ({}));

const { addReportPhoto } = await import("./actions");

const ID = "44444444-4444-4444-8444-444444444444";

function mount(opts: { party: boolean }) {
  const inserts: unknown[] = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq"]) chain[method] = () => chain;
      chain["maybeSingle"] = async () => ({
        data: table === "inspection_requests" && opts.party ? { id: ID } : null,
        error: null,
      });
      chain["insert"] = (row: unknown) => {
        inserts.push(row);
        return chain;
      };
      chain["single"] = async () => ({
        data: { id: "p1", storage_path: `${ID}/a.jpg`, item: null, created_at: "2026-10-17T10:00:00Z" },
        error: null,
      });
      return chain;
    },
  };
  session.resolveSession.mockResolvedValue({ state: "signed-in", user: { id: "u1" }, supabase: client });
  return { inserts };
}

beforeEach(() => {
  session.resolveSession.mockReset();
  scrub.scrubPublicPhoto.mockReset();
  scrub.scrubPublicPhoto.mockResolvedValue({ ok: true, changed: true });
});

describe("addReportPhoto strips a photo before recording it", () => {
  it("scrubs a photo in the inspection-photos bucket, then records it", async () => {
    const { inserts } = mount({ party: true });
    const result = await addReportPhoto({ inspectionId: ID, storagePath: `${ID}/a.jpg` });
    expect(result.ok).toBe(true);
    expect(scrub.scrubPublicPhoto).toHaveBeenCalledWith("inspection-photos", `${ID}/a.jpg`);
    expect(inserts).toHaveLength(1);
  });

  it("records nothing when the photo could not be scrubbed", async () => {
    const { inserts } = mount({ party: true });
    scrub.scrubPublicPhoto.mockResolvedValue({ ok: false, reason: "unsupported-format" });
    const result = await addReportPhoto({ inspectionId: ID, storagePath: `${ID}/a.heic` });
    expect(result.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("touches nobody's object for a caller who is not a party", async () => {
    const { inserts } = mount({ party: false });
    const result = await addReportPhoto({ inspectionId: ID, storagePath: `${ID}/a.jpg` });
    expect(result.ok).toBe(false);
    expect(scrub.scrubPublicPhoto).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it("leaves a PDF as uploaded", async () => {
    const { inserts } = mount({ party: true });
    const result = await addReportPhoto({ inspectionId: ID, storagePath: `${ID}/a.pdf` });
    expect(result.ok).toBe(true);
    expect(scrub.scrubPublicPhoto).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(1);
  });
});
