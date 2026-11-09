import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/*
 * MY OWN AVATAR OPENS MY OWN PROFILE (the founder, 13 October 2026).
 *
 * One mechanism: `/u/<handle>` redirects the signed-in owner to `/profile`.
 * These tests hold (1) the mechanism itself, run against the real page with
 * its reads stubbed, and (2) the coverage: every surface that links to a
 * person goes through that address, so none can bring the bug back.
 */

const redirect = vi.fn((href: string) => {
  throw new Error(`NEXT_REDIRECT:${href}`);
});
vi.mock("next/navigation", () => ({ redirect: (href: string) => redirect(href), notFound: () => undefined }));

const loadPublicProfile = vi.fn();
vi.mock("@/lib/social/profiles-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/social/profiles-queries")>()),
  loadPublicProfile: (raw: string) => loadPublicProfile(raw),
}));
vi.mock("@/lib/social/flag", () => ({ isSocialEnabled: async () => true }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));

const { default: SocialProfilePage } = await import("./page");

const params = (handle: string) => ({ params: Promise.resolve({ handle }), searchParams: Promise.resolve({}) });

describe("/u/[handle] for the person it names", () => {
  it("redirects the signed-in owner to /profile before reading anything else", async () => {
    loadPublicProfile.mockResolvedValueOnce({ state: "found", isOwner: true, profile: { userId: "me", handle: "ada" } });
    await expect(SocialProfilePage(params("ada"))).rejects.toThrow("NEXT_REDIRECT:/profile");
    expect(redirect).toHaveBeenCalledWith("/profile");
  });

  it("does not trust the typed handle: ownership is the server's answer, so a stranger is not redirected", async () => {
    redirect.mockClear();
    loadPublicProfile.mockResolvedValueOnce({ state: "missing", handle: "ada" });
    await SocialProfilePage(params("ada")).catch(() => undefined);
    expect(redirect).not.toHaveBeenCalled();
  });
});

const SRC = join(import.meta.dirname, "../../../..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("every surface that links to a person goes through /u/<handle>", () => {
  /* The surfaces the founder named, and the files that draw them. A person's
     avatar and name must link to the one address the redirect guards. */
  const SURFACES: Record<string, string> = {
    "feed posts": "components/social/feed/PostCard.tsx",
    "post bodies and mentions": "components/social/feed/PostBody.tsx",
    stories: "components/social/story/StoryViewer.tsx",
    "replies and comments": "components/social/comments/CommentsSheet.tsx",
    "people lists": "components/social/profile/PeopleList.tsx",
    "find people": "components/social/find/PeopleSections.tsx",
    "who to follow": "components/social/follow/WhoToFollow.tsx",
    chat: "app/(app)/messages/[id]/ThreadView.tsx",
    "a listing's lister": "components/app/listing/ListingAgentCard.tsx",
  };

  for (const [surface, file] of Object.entries(SURFACES)) {
    it(`${surface} link to /u/<handle>, the redirected address`, () => {
      expect(readFileSync(join(SRC, file), "utf8"), file).toMatch(/\/u\/\$\{|"\/u\/|`\/u\//);
    });
  }

  it("no other route draws a public profile, so there is no second door past the redirect", () => {
    const readers = sourceFiles(join(SRC, "app"))
      .filter((file) => readFileSync(file, "utf8").includes("loadPublicProfile("))
      .map((file) => file.slice(SRC.length + 1).replaceAll("\\", "/"))
      .sort();
    /* The two profile PAGES, plus the profile's share-card image. The image
       route reads the same public fields but is not a door: it returns a JPEG
       for an unfurler, never a navigable profile, so the owner redirect does
       not apply to it (an owner sharing their own card is expected). */
    expect(readers).toEqual([
      "app/(app)/stories/[id]/page.tsx",
      "app/(app)/u/[handle]/opengraph-image.tsx",
      "app/(app)/u/[handle]/page.tsx",
    ]);
  });

  it("the redirect target is the profile page, and the page uses the shared constant", () => {
    expect(readFileSync(join(SRC, "lib/social/own-profile.ts"), "utf8")).toContain('OWN_PROFILE_HREF = "/profile"');
    expect(readFileSync(join(SRC, "app/(app)/u/[handle]/page.tsx"), "utf8")).toContain("if (view.isOwner) redirect(OWN_PROFILE_HREF);");
  });
});
