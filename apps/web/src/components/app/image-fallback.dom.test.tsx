import { describe, expect, it } from "vitest";
import { hasBrowser, mountInBrowser } from "@/lib/testing/mount-in-browser";

describe.skipIf(!hasBrowser && !process.env.CI)("ImageFallbackGuard", () => {
  it("swaps a failed picture for the quiet tile once, keeping its alt, and leaves a good one alone", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { ImageFallbackGuard } from "@/components/app/ImageFallbackGuard";
        import { mount } from "@/lib/testing/browser-root";
        mount(
          <div>
            <img id="bad" alt="A room" src="http://localhost:9/missing.jpg" width="100" height="80" />
            <img id="good" alt="Ok" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="10" height="10" />
            <ImageFallbackGuard />
          </div>,
        );
      `,
      url: "http://localhost/",
    });
    try {
      await page.waitForFunction(() => document.getElementById("bad")?.getAttribute("data-broken") === "1");
      const bad = await page.evaluate(() => {
        const el = document.getElementById("bad") as HTMLImageElement;
        return { src: el.src.slice(0, 25), alt: el.alt, loaded: el.complete && el.naturalWidth > 0 };
      });
      expect(bad.src).toBe("data:image/svg+xml,%3Csvg");
      expect(bad.alt).toBe("A room");
      expect(bad.loaded).toBe(true);
      expect(await page.evaluate(() => document.getElementById("good")?.getAttribute("data-broken"))).toBeNull();
    } finally {
      await close();
    }
  }, 60_000);
});
