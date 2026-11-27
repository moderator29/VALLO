import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";

/**
 * EVERY PAGE WITHOUT A TOP BAR DRAWS ITS OWN WAY BACK.
 *
 * This has now gone wrong twice in two weeks, in opposite directions, which is
 * why it is pinned rather than just fixed.
 *
 * `AppShell` draws no header on a photo-first detail page, so the picture can
 * reach the top edge. That is deliberate and it is the `edgeToEdge` test in
 * that file. The consequence is that `BarBack`, which portals a control into
 * the header's lead slot, finds no slot on exactly those routes and renders
 * nothing at all. On 13 November the listing's back was moved into that bar;
 * from then until the founder caught it on 27 November the listing page had no
 * way back until its sticky section tabs scrolled into view.
 *
 * So the rule is the pair: a route the shell draws edge to edge MUST render
 * `DetailBack`, and `DetailBack` must hide itself wherever a bar did find a
 * slot, so the two can never both show and never both be missing.
 *
 * Source assertions, for the reason `example-listings.test.ts` gives: these
 * pages cannot be imported here. What has to hold is not how the control looks
 * once, it is that a page the shell leaves barless cannot ship without one.
 */

const SRC = join(process.cwd(), "src");
const read = (path: string) => withoutComments(readFileSync(join(SRC, path), "utf8"));

/** The routes `AppShell` deliberately draws with no header. */
const EDGE_TO_EDGE = ["listing", "stay", "restaurant"] as const;

/** Where each of those routes draws its own control. */
const DRAWS_ITS_OWN = [
  "app/(app)/listing/[id]/page.tsx",
  "app/(app)/stay/[id]/StayDetailView.tsx",
  "app/(app)/restaurant/[id]/RestaurantFace.tsx",
] as const;

describe("the way back on a page with no top bar", () => {
  it("knows which routes the shell leaves without a header", () => {
    const shell = read("components/app/AppShell.tsx");
    /* If this changes, the list below has to change with it: a new barless
       route with no back is the whole defect this file guards. */
    const match = /const edgeToEdge = [^;]+;/.exec(shell)?.[0] ?? "";
    expect(match.length).toBeGreaterThan(0);
    for (const route of EDGE_TO_EDGE) expect(match).toContain(route);
    expect(shell).toMatch(/showsHeader = .*!edgeToEdge/);
  });

  it.each(DRAWS_ITS_OWN)("%s draws its own back", (path) => {
    expect(read(path)).toMatch(/<DetailBack\b/);
  });

  it("gives the control a real destination on each one", () => {
    /* `BackControl` goes back in history; the fallback is where it lands when
       the page was opened cold, from a link or a share. */
    for (const path of DRAWS_ITS_OWN) {
      expect(read(path)).toMatch(/<DetailBack\s+fallback="\/[a-z]+"/);
    }
  });

  it("stands down where a bar is carrying one instead", () => {
    const css = readFileSync(join(SRC, "app/css/space-card.css"), "utf8");
    /* `BarBack` sets `data-page-back` on the document only once it has found a
       lead slot to portal into, so this is the exact condition. */
    expect(css).toMatch(/:root\[data-page-back\][^}]*\.nf-detail-back[\s\S]{0,60}display:\s*none/);
    expect(read("components/app/BarBack.tsx")).toMatch(/setAttribute\("data-page-back"/);
  });

  it("is a row outside the photograph, never a control on it", () => {
    /* The founder, 16 November: "don't make the go back button be inside the
       image container ... it should be outside the container but beside, not
       sit on top". The row sits above the card; the gallery keeps none. */
    const page = read("app/(app)/listing/[id]/page.tsx");
    expect(page).toMatch(/<DetailBack[\s\S]{0,200}?<div className="nf-sc nf-sc-top"/);
    expect(read("components/app/listing/ListingGallery.tsx")).not.toMatch(
      /absolute[^"]*\bleft-3 top-3[^"]*"[^>]*>\s*<BackControl/,
    );
  });
});
