/**
 * A FOLLOW NEVER FAILS VISIBLY (3 November 2026). With no signal the label
 * stays on "Following" and the tap waits in the outbox; a real refusal puts
 * the label back and says why.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { FollowButton } from "@/components/social/profile/FollowButton";
  mount(<FollowButton handle="ada_o" initialFollowing={false} signedIn />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the follow button on a weak signal", () => {
  it("stays on Following when the request dies, and shows no error", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      actions: { toggleFollow: `async () => { throw new TypeError("Failed to fetch"); }` },
    });
    try {
      await page.getByRole("button", { name: /Follow @ada_o/ }).click();
      await page.getByRole("button", { name: /Following @ada_o/ }).waitFor();
      expect(await page.getByRole("alert").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("goes back and says why when the server refuses", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      actions: { toggleFollow: `async () => ({ ok: false, error: "You cannot follow this person." })` },
    });
    try {
      await page.getByRole("button", { name: /Follow @ada_o/ }).click();
      await page.getByText("You cannot follow this person.").waitFor();
      expect(await page.getByRole("button", { name: /Follow @ada_o/ }).count()).toBe(1);
    } finally {
      await close();
    }
  });
});
