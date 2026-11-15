/**
 * THE PEOPLE PAGE'S SEARCH: a big field that searches as you type through the
 * existing people search action. Two characters or more replace the sections
 * with the results (each row a person with a Follow), clearing brings the
 * sections back, and an answer to anything but what is in the box is never
 * shown.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { PORTED_CSS } from "@/components/ui/ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = [PORTED_CSS, readFileSync(join(process.cwd(), "src", "components", "social", "find", "people-v2.css"), "utf8")].join("\n");

const WORDS = `{
  searchLabel: "Search people", searchPlaceholder: "Search by name or @handle", clear: "Clear the search",
  searching: "Looking for people", resultsFor: "Results for {query}", noResultsTitle: "Nobody called {query} yet",
  noResultsBody: "Check the spelling.", unavailable: "Not available", roleLandlord: "Landlord", roleAgent: "Agent",
  openProfile: "Open {name}", you: "You", yourProfile: "Your profile",
  filterLabel: "Show", filterAll: "Everyone", filterAgents: "Agents", filterLandlords: "Landlords",
  filterMembers: "Members", filterVerified: "Verified", filterNobody: "Nobody matches that.", filterReset: "Show everyone",
  resultsCount: { one: "{count} person", other: "{count} people" },
  recentTitle: "Recent searches", recentClear: "Clear all", recentRemove: "Remove {query}",
  tipTitle: "Search tips", tipBody: "Type at least two letters."
}`;

const entry = `
  import { PeopleFinder } from "@/components/social/find/PeopleFinder";
  import { mount } from "@/lib/testing/browser-root";
  import { AuthGateProvider } from "@/components/auth/AuthGate";
  mount(
    <AuthGateProvider signedIn>
      <PeopleFinder words={${WORDS}} initialQuery="" initialHits={null} signedIn>
        <section data-testid="sections"><h2>Top agents</h2></section>
      </PeopleFinder>
    </AuthGateProvider>
  );
`;

const ADA = `async (q) => ({ ok: true, data: { query: q, signedIn: true, hits: [
  { handle: "ada_obi", displayLabel: "Ada Obi", avatarUrl: "", isAgent: false, role: null, tier: "none", viewerFollows: false, isViewer: false },
  { handle: "adaeze", displayLabel: "Adaeze Homes", avatarUrl: "", isAgent: true, role: "agent", tier: "gold", viewerFollows: true, isViewer: false },
] } })`;

describe.skipIf(!hasBrowser && !process.env.CI)("the people search", () => {
  it("shows the sections until two characters are typed, then the results, then the sections again", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, actions: { searchPeople: ADA } });
    try {
      const field = page.getByRole("textbox", { name: "Search people" });
      expect(await page.getByTestId("sections").count()).toBe(1);
      await field.fill("a");
      expect(await page.getByTestId("sections").count()).toBe(1);
      await field.fill("ada");
      await page.getByTestId("people-results").getByText("Results for ada").waitFor({ timeout: 8000 });
      expect(await page.getByTestId("sections").count()).toBe(0);
      const rows = page.getByTestId("person-row");
      expect(await rows.count()).toBe(2);
      expect(await rows.nth(1).innerText()).toContain("Agent");
      /* The one already followed says so; the other offers Follow. */
      expect(await rows.nth(0).getByRole("button", { name: /Follow @ada_obi/ }).count()).toBe(1);
      expect(await rows.nth(1).getByRole("button", { name: /Following @adaeze/ }).count()).toBe(1);
      await page.getByRole("button", { name: "Clear the search" }).click();
      expect(await page.getByTestId("sections").count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("strips a leading @ and asks the action for the longer page answer", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, actions: { searchPeople: ADA } });
    try {
      await page.getByRole("textbox", { name: "Search people" }).fill("@ada");
      await page.getByTestId("people-results").getByText("Results for ada").waitFor({ timeout: 8000 });
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls[0]).toEqual(["searchPeople", "ada", true]);
    } finally {
      await close();
    }
  });

  it("says so when nobody matches, and does not fall back to the sections", async () => {
    const none = `async (q) => ({ ok: true, data: { query: q, signedIn: true, hits: [] } })`;
    const { page, close } = await mountInBrowser({ entry, css: CSS, actions: { searchPeople: none } });
    try {
      await page.getByRole("textbox", { name: "Search people" }).fill("zzzz");
      await page.getByText("Nobody called @zzzz yet").waitFor({ timeout: 8000 });
      expect(await page.getByTestId("sections").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("says it is unavailable when the search fails, rather than claiming nobody matched", async () => {
    const fail = `async () => ({ ok: false, error: "x" })`;
    const { page, close } = await mountInBrowser({ entry, css: CSS, actions: { searchPeople: fail } });
    try {
      await page.getByRole("textbox", { name: "Search people" }).fill("ada");
      await page.getByText("Not available").waitFor({ timeout: 8000 });
      expect(await page.getByText(/Nobody called/).count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("the field is a big target and the clear control is 44px", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, actions: { searchPeople: ADA } });
    try {
      const field = page.getByRole("textbox", { name: "Search people" });
      expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await field.fill("ada");
      const clear = page.getByRole("button", { name: "Clear the search" });
      const box = (await clear.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    } finally {
      await close();
    }
  });
});
