import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";

import { EMPTY_LISTING } from "@/lib/features/roommates/model";
import { CopyScope } from "@/lib/i18n/copy-scope";
import { copyScopeOf } from "@/lib/i18n/copy-scope-of";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";


/**
 * POST ON ROOMMATES: the review asks a room offer for the lister's connection
 * and the declaration; publishing an unfinished post is refused on the
 * device (no server call), and a finished one is sent once, with publish.
 */
const t = getDictionary("en").roommates;
const ME = { userId: "55555555-5555-4555-8555-555555555555", name: "Test Lister", avatarUrl: null };
const EDITING = { ...EMPTY_LISTING, id: "66666666-6666-4666-8666-666666666666" };

/* The flow reads the router; the review renders without one. */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }), usePathname: () => "/roommates/new" }));

/** The flow at its review, as static HTML, under the route's words. */
async function review(draft: object, status: "draft" | "live"): Promise<string> {
  const { PostFlow } = await import("./PostFlow");
  return renderToStaticMarkup(
    <CopyScope copy={copyScopeOf(getDictionary("en"), ["roommates"])}>
      <PostFlow initial={{ ...EMPTY_LISTING, ...draft }} status={status} schools={[]} me={ME} />
    </CopyScope>,
  );
}

describe("the post flow's review", () => {
  it("asks a room offer who the lister is to the home, and for the declaration", async () => {
    const html = await review(EDITING, "draft");
    expect(html).toContain('data-testid="post-step-review"');
    expect(html).toContain(t.authority.owner);
    expect(html).toContain(t.create.declaration);
    expect(html).toContain(t.review.submit);
  });

  it("does not ask a find-together post for a declaration", async () => {
    const html = await review({ ...EDITING, kind: "together" }, "draft");
    expect(html).not.toContain(t.create.declaration);
  });

  it("offers Save changes, not Publish, on a post that is already live", async () => {
    const html = await review(EDITING, "live");
    expect(html).toContain(t.ui.onboarding.saveChanges);
  });
});

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });

describe.skipIf(!hasBrowser)("publishing, in a browser", () => {
  beforeAll(warmBrowser);
  afterAll(closeBrowser);

  const entry = (draft: string) => `
    import { getDictionary } from "@vallo/i18n";
    import { mount } from "@/lib/testing/browser-root";
    import { CopyScope } from "@/lib/i18n/copy-scope";
    import { copyScopeOf } from "@/lib/i18n/copy-scope-of";
    import { EMPTY_LISTING } from "@/lib/features/roommates/model";
    import { PostFlow } from "@/app/(app)/roommates/new/_parts/PostFlow";
    mount(
      <CopyScope copy={copyScopeOf(getDictionary("en"), ["roommates"])}>
        <PostFlow initial={{ ...EMPTY_LISTING, ...${draft} }} status="draft" schools={[]} me={${JSON.stringify(ME)}} />
      </CopyScope>,
    );
  `;

  it("refuses an unfinished post on the device and goes to the first missing step", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(`{ id: "${EDITING.id}" }`), actions: { saveRoommateListing: "async () => ({ ok: true, data: { id: 'x', status: 'live' } })" } });
    try {
      await page.getByTestId("post-publish").click();
      await page.getByTestId("post-step-location").waitFor();
      const calls = await page.evaluate(() => (window as unknown as { __calls?: unknown[] }).__calls ?? []);
      expect(calls).toEqual([]);
    } finally {
      await close();
    }
  });

  it("sends a finished post once, with publish, and shows the submitted-for-review screen", async () => {
    const draft = `{ id: "${EDITING.id}", title: "Ensuite room in a quiet flat", city: "Lagos", rentMinor: 120000000, authority: "owner", declared: true, photos: ["u/1.jpg", "u/2.jpg", "u/3.jpg"] }`;
    const { page, close } = await mountInBrowser({ entry: entry(draft), actions: { saveRoommateListing: "async () => ({ ok: true, data: { id: 'p1', status: 'submitted' } })" } });
    try {
      await page.getByTestId("post-publish").click();
      await page.getByTestId("post-submitted").waitFor();
      const calls = (await page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? [])) as unknown[][];
      expect(calls).toHaveLength(1);
      expect(calls[0]![0]).toBe("saveRoommateListing");
      expect(calls[0]![2]).toEqual({ publish: true });
    } finally {
      await close();
    }
  });
});
