import { describe, expect, it, vi } from "vitest";

/** An admin never decides a place they proposed or their own moderator application. */
const ME = "11111111-1111-4111-8111-111111111111";
const updates = vi.hoisted(() => ({ count: 0 }));
const row = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

function client() {
  return {
    from() {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: row.value, error: null });
      chain.update = () => {
        updates.count += 1;
        return chain;
      };
      return chain;
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../admin/audit", () => ({ writeAudit: async () => true }));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => client() }));
vi.mock("../admin/guard", () => ({
  requireAdmin: async () => ({ state: "admin", supabase: client(), userClient: client(), user: { id: ME } }),
  adminRefusal: () => "refused",
}));

const { decideArea, decideModeratorApplication } = await import("./admin-actions");

describe("social desks refuse their own case", () => {
  it("a place the admin proposed", async () => {
    updates.count = 0;
    row.value = { id: "22222222-2222-4222-8222-222222222222", slug: "yaba", name: "Yaba", city: "Lagos", status: "PROPOSED", created_by: ME };
    const result = await decideArea({ areaId: "22222222-2222-4222-8222-222222222222", decision: "APPROVE" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("another admin");
    expect(updates.count).toBe(0);
  });

  it("the admin's own moderator application", async () => {
    updates.count = 0;
    row.value = { id: "33333333-3333-4333-8333-333333333333", area_id: "a", user_id: ME, status: "PENDING", areas: null };
    const result = await decideModeratorApplication({ applicationId: "33333333-3333-4333-8333-333333333333", decision: "APPROVE" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("another admin");
    expect(updates.count).toBe(0);
  });
});
