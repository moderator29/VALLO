import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * THE SOCIAL MEDIA DESK'S WRITES. Every action runs on the scoped service
 * client `requireAdmin("social_media")` hands out once the database has
 * already proved the scope and the handbook; these tests check the SQL each
 * action issues, never a real database.
 */

const guard = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: guard.requireAdmin }));
vi.mock("@/lib/admin/audit", () => ({ writeAudit: vi.fn(async () => true) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

const {
  createDraft,
  updateDraft,
  submitForApproval,
  approveDraft,
  sendBack,
  markPosted,
  cancelPost,
  uploadMedia,
  deleteMedia,
} = await import("./actions");

const POST_ID = "11111111-1111-1111-1111-111111111111";

function asAdmin(fake: ReturnType<typeof fakeSupabase>) {
  guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "staff-1" }, supabase: fake.client });
}

const DRAFT_INPUT = {
  platform: "instagram",
  category: "property",
  format: "feed_post",
  slot: "post_1",
  campaign: "December push",
  caption: "Hello Lagos",
  plannedAt: "2026-11-20",
  mediaUrls: [],
};

beforeEach(() => {
  guard.requireAdmin.mockReset();
});

describe("staff gate", () => {
  it("refuses a signed-out caller without writing", async () => {
    guard.requireAdmin.mockResolvedValue({ state: "signed-out" });
    const result = await createDraft(DRAFT_INPUT);
    expect(result.ok).toBe(false);
  });

  it("refuses a caller who is not this desk's staff", async () => {
    guard.requireAdmin.mockResolvedValue({ state: "not-admin" });
    const result = await createDraft(DRAFT_INPUT);
    expect(result.ok).toBe(false);
  });
});

describe("createDraft", () => {
  it("rejects an input with no platform before writing", async () => {
    const fake = fakeSupabase();
    asAdmin(fake);
    const result = await createDraft({ ...DRAFT_INPUT, platform: "snapchat" });
    expect(result.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("inserts a draft with the caller as created_by", async () => {
    const fake = fakeSupabase({ social_posts: { insert: { data: { id: POST_ID }, error: null } } });
    asAdmin(fake);
    const result = await createDraft(DRAFT_INPUT);
    expect(result.ok).toBe(true);
    const insert = fake.of("social_posts", "insert")[0];
    expect((insert?.values as { status?: string; created_by?: string })?.status).toBe("draft");
    expect((insert?.values as { created_by?: string })?.created_by).toBe("staff-1");
  });
});

describe("submitForApproval / approveDraft / sendBack", () => {
  it("moves a draft to awaiting_approval", async () => {
    const fake = fakeSupabase({ social_posts: { update: { data: [{ id: POST_ID }], error: null } } });
    asAdmin(fake);
    const result = await submitForApproval(POST_ID);
    expect(result.ok).toBe(true);
    const update = fake.of("social_posts", "update")[0];
    expect((update?.values as { status?: string })?.status).toBe("awaiting_approval");
  });

  it("refuses to approve when the database finds no matching row (already decided)", async () => {
    const fake = fakeSupabase({ social_posts: { update: { data: [], error: null } } });
    asAdmin(fake);
    const result = await approveDraft(POST_ID);
    expect(result.ok).toBe(false);
  });

  it("requires a real reason to send a post back", async () => {
    const fake = fakeSupabase();
    asAdmin(fake);
    const result = await sendBack(POST_ID, "no");
    expect(result.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("records the rejection reason on send back", async () => {
    const fake = fakeSupabase({ social_posts: { update: { data: [{ id: POST_ID }], error: null } } });
    asAdmin(fake);
    const result = await sendBack(POST_ID, "Needs a better photo");
    expect(result.ok).toBe(true);
    const update = fake.of("social_posts", "update")[0];
    expect((update?.values as { rejection_reason?: string })?.rejection_reason).toBe("Needs a better photo");
  });
});

describe("markPosted", () => {
  it("rejects a link that is not a URL", async () => {
    const fake = fakeSupabase();
    asAdmin(fake);
    const result = await markPosted(POST_ID, { liveUrl: "not a url", postedAt: "" });
    expect(result.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("records the post as posted with the live link", async () => {
    const fake = fakeSupabase({ social_posts: { update: { data: [{ id: POST_ID }], error: null } } });
    asAdmin(fake);
    const result = await markPosted(POST_ID, { liveUrl: "https://instagram.com/p/x", postedAt: "2026-11-20T10:00" });
    expect(result.ok).toBe(true);
    const update = fake.of("social_posts", "update")[0];
    expect((update?.values as { status?: string; live_url?: string })?.status).toBe("posted");
    expect((update?.values as { live_url?: string })?.live_url).toBe("https://instagram.com/p/x");
  });
});

describe("cancelPost", () => {
  it("issues an update to cancelled", async () => {
    const fake = fakeSupabase({ social_posts: { update: { data: [{ id: POST_ID }], error: null } } });
    asAdmin(fake);
    const result = await cancelPost(POST_ID);
    expect(result.ok).toBe(true);
    const update = fake.of("social_posts", "update")[0];
    expect((update?.values as { status?: string })?.status).toBe("cancelled");
  });
});

describe("updateDraft", () => {
  it("says the post has moved on when the database finds no row to edit", async () => {
    const fake = fakeSupabase({ social_posts: { update: { data: [], error: null } } });
    asAdmin(fake);
    const result = await updateDraft(POST_ID, DRAFT_INPUT);
    expect(result.ok).toBe(false);
  });
});

describe("media library writes", () => {
  it("refuses a file type that is not an image or a short video", async () => {
    const fake = fakeSupabase();
    asAdmin(fake);
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadMedia(formData);
    expect(result.ok).toBe(false);
  });

  it("uploads an image to the bucket", async () => {
    const fake = fakeSupabase();
    (fake.client as unknown as { storage: unknown }).storage = {
      from: () => ({ upload: vi.fn(async () => ({ data: { path: "x" }, error: null })) }),
    };
    asAdmin(fake);
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadMedia(formData);
    expect(result.ok).toBe(true);
  });

  it("refuses to delete a file that is attached to a post", async () => {
    const fake = fakeSupabase({ social_posts: { select: { data: [{ id: POST_ID }], error: null } } });
    asAdmin(fake);
    const result = await deleteMedia("abc.jpg");
    expect(result.ok).toBe(false);
  });
});
