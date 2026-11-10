import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * THE SOCIAL MEDIA DESK'S DOOR AND ITS HONEST EMPTY STATES. No platform API
 * is ever reachable from this page; these checks are about the gate
 * (`requireAdmin("social_media")`) and about the page never claiming a
 * number it did not read.
 */
const guard = vi.hoisted(() => ({ state: "admin" as string }));
vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: async () => (guard.state === "admin" ? { state: "admin", user: { id: "staff-1" }, supabase: {} } : { state: guard.state }),
}));
vi.mock("@/components/admin/copilot/AdminCopilot", () => ({ AdminCopilot: ({ context }: { context: string | null }) => <div data-testid="copilot">{context ?? "no-context"}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

const reads = vi.hoisted(() => ({ posts: vi.fn(), media: vi.fn() }));
vi.mock("@/lib/admin/social-media/queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/social-media/queries")>("@/lib/admin/social-media/queries");
  return { ...actual, readSocialPosts: reads.posts, readMediaLibrary: reads.media };
});

const { default: Page } = await import("./page");

function textOf(node: React.ReactElement): string {
  return renderToStaticMarkup(node).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("the social media desk's door", () => {
  it("does not read anything for a signed-out caller", async () => {
    guard.state = "signed-out";
    reads.posts.mockReset();
    reads.media.mockReset();
    const el = await Page({ searchParams: Promise.resolve({}) });
    expect(reads.posts).not.toHaveBeenCalled();
    expect(textOf(el as React.ReactElement)).toMatch(/Sign in/);
  });

  it("says this desk is for the Social Media Manager when the caller holds no such scope", async () => {
    guard.state = "not-admin";
    const el = await Page({ searchParams: Promise.resolve({}) });
    expect(textOf(el as React.ReactElement)).toMatch(/Social Media Manager/);
  });
});

describe("the calendar and the honest empty state", () => {
  it("shows the not-set-up note when the table is missing, and never crashes", async () => {
    guard.state = "admin";
    reads.posts.mockResolvedValue({ state: "not-open" });
    reads.media.mockResolvedValue({ state: "not-open" });
    const el = await Page({ searchParams: Promise.resolve({}) });
    const text = textOf(el as React.ReactElement);
    expect(text).toMatch(/not on this database yet/);
    expect(text).not.toMatch(/Error|undefined|NaN/);
  });

  it("builds the copilot's context only from real rows, never a made-up figure", async () => {
    guard.state = "admin";
    reads.posts.mockResolvedValue({
      state: "ok",
      data: [
        {
          id: "p1",
          platform: "instagram",
          category: "property",
          format: "feed_post",
          slot: "post_1",
          campaign: "December push",
          caption: "Hello",
          plannedAt: new Date().toISOString().slice(0, 10),
          status: "draft",
          mediaUrls: [],
          approvedBy: null,
          approvedAt: null,
          postedAt: null,
          liveUrl: null,
          rejectionReason: null,
          createdBy: "u1",
          createdAt: "2026-11-01T00:00:00Z",
          updatedAt: "2026-11-01T00:00:00Z",
        },
      ],
    });
    reads.media.mockResolvedValue({ state: "ok", data: [] });
    const el = await Page({ searchParams: Promise.resolve({}) });
    const text = textOf(el as React.ReactElement);
    expect(text).toMatch(/1 posts scheduled this week/);
    expect(text).toMatch(/1 campaign active/);
  });
});
