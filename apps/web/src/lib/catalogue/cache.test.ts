import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The catalogue cache's contract with Next: every entry carries the
 * catalogue tag and its own tags and the short backstop, a write expires tags
 * at once (`{ expire: 0 }`), and a test or script without a Next server runs
 * the read straight through.
 */

const revalidateTag = vi.fn();
const unstableCache = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  unstable_cache: (...args: unknown[]) => unstableCache(...args),
}));

import {
  CATALOGUE_LISTS_TAG,
  CATALOGUE_REVALIDATE_SECONDS,
  CATALOGUE_TAG,
  catalogueCached,
  expireCatalogueTags,
  listingTag,
} from "./cache";
import { catalogueChanged, catalogueTagsFor } from "./invalidate";

beforeEach(() => {
  revalidateTag.mockReset();
  unstableCache.mockReset();
});

describe("catalogueCached", () => {
  it("keeps the read under the catalogue tag, its own tags and the 60 second backstop", async () => {
    unstableCache.mockImplementation((fn: () => Promise<unknown>) => fn);
    const value = await catalogueCached(["by-id", "x"], [listingTag("X")], async () => "row");
    expect(value).toBe("row");
    expect(unstableCache).toHaveBeenCalledTimes(1);
    const [, key, options] = unstableCache.mock.calls[0]!;
    expect(key).toEqual(["catalogue", "by-id", "x"]);
    expect(options).toEqual({ tags: [CATALOGUE_TAG, "catalogue:listing:x"], revalidate: CATALOGUE_REVALIDATE_SECONDS });
    expect(CATALOGUE_REVALIDATE_SECONDS).toBeLessThanOrEqual(60);
  });

  it("runs the read itself where there is no Next cache (a test, a script)", async () => {
    unstableCache.mockImplementation(() => async () => {
      throw new Error("Invariant: incrementalCache missing in unstable_cache");
    });
    const load = vi.fn(async () => 7);
    expect(await catalogueCached(["k"], [], load)).toBe(7);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("lets a failed read through, so nothing is kept and the caller decides", async () => {
    unstableCache.mockImplementation((fn: () => Promise<unknown>) => fn);
    await expect(
      catalogueCached(["k"], [], async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
  });
});

describe("expiring the catalogue", () => {
  it("expires each tag at once, never stale-while-revalidate", () => {
    expireCatalogueTags(["a", "b", "a"]);
    expect(revalidateTag.mock.calls).toEqual([
      ["a", { expire: 0 }],
      ["b", { expire: 0 }],
    ]);
  });

  it("never throws when Next refuses (outside an action), so a committed write still reports success", () => {
    revalidateTag.mockImplementation(() => {
      throw new Error("outside action");
    });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => catalogueChanged({ listingId: "L1" })).not.toThrow();
    quiet.mockRestore();
  });

  it("names the changed thing and every list it can appear on", () => {
    expect(catalogueTagsFor({ listingId: "AbC" })).toEqual([CATALOGUE_LISTS_TAG, "catalogue:listing:abc"]);
    expect(catalogueTagsFor({ stayId: "s1" })).toEqual([CATALOGUE_LISTS_TAG, "catalogue:stay:s1"]);
    expect(catalogueTagsFor({ venueId: "v1" })).toEqual([CATALOGUE_LISTS_TAG, "catalogue:venue:v1"]);
  });

  it("expires the whole catalogue when nothing is named", () => {
    catalogueChanged();
    expect(revalidateTag.mock.calls.map(([tag]) => tag)).toEqual([CATALOGUE_LISTS_TAG, CATALOGUE_TAG]);
  });

  it("matches the tag a cached listing was kept under, whatever the id's case", () => {
    catalogueChanged({ listingId: "ED000000-0000-4000-8000-00000000000D" });
    expect(revalidateTag.mock.calls.map(([tag]) => tag)).toContain(listingTag("ed000000-0000-4000-8000-00000000000d"));
  });
});
