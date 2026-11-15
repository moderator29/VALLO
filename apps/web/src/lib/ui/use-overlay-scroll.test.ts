import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * THE SCROLL COMES BACK ONLY ON THE SAME PAGE (A9).
 *
 * `lockBody` pins the page under a sheet and, on the last release, scrolls the
 * window back to where it was. It did that even when the release came after
 * the route changed (a sheet closed by a link inside it), so the new page
 * opened at the old page's scroll position, mid-page. It now restores only
 * when the address is the one the lock was taken on.
 */
function stubBrowser(href: string, scrollY: number) {
  const style: Record<string, string> = {};
  const scrollTo = vi.fn();
  const location = { href };
  vi.stubGlobal("document", { body: { style }, documentElement: { clientWidth: 1000 } });
  vi.stubGlobal("window", { scrollY, innerWidth: 1000, location, scrollTo });
  return { style, scrollTo, location };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const { lockBody } = await import("./use-overlay");

describe("lockBody", () => {
  it("pins the page and scrolls it back on release, on the same page", () => {
    const { style, scrollTo } = stubBrowser("https://vallospaces.com/listing/abc", 1200);
    const release = lockBody();
    expect(style.position).toBe("fixed");
    expect(style.top).toBe("-1200px");
    release();
    expect(style.position).toBe("");
    /* Instantly, never animated: the page carries `scroll-behavior: smooth`,
       and an animated restore was the feed scrolling down by itself after a
       sheet closed (the founder, 15 November 2026). */
    expect(scrollTo).toHaveBeenCalledWith({ top: 1200, left: 0, behavior: "instant" });
  });

  it("unpins but leaves the scroll alone when the route changed while it was locked", () => {
    const { style, scrollTo, location } = stubBrowser("https://vallospaces.com/listing/abc", 1200);
    const release = lockBody();
    location.href = "https://vallospaces.com/messages/new?listing=abc";
    release();
    expect(style.position).toBe("");
    expect(style.overflow).toBe("");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("restores only on the last of two nested locks, still against the first page", () => {
    const { scrollTo, location } = stubBrowser("https://vallospaces.com/home", 300);
    const outer = lockBody();
    const inner = lockBody();
    inner();
    expect(scrollTo).not.toHaveBeenCalled();
    location.href = "https://vallospaces.com/home";
    outer();
    expect(scrollTo).toHaveBeenCalledWith({ top: 300, left: 0, behavior: "instant" });
  });
});
