import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLE_STATEMENT } from "@/lib/listings/syndication";
import { BANNED_IN_EXAMPLE_COPY, firstBannedPhrase } from "@/lib/copy/banned-phrases";
import { withoutComments } from "@/lib/copy/source-scan";

/**
 * THE EXAMPLE-LISTING RULES, GUARDED BY SOURCE.
 *
 * `ExampleNotice` is gone (D24: the visible "example" labelling came off the
 * listing surfaces, and nothing imported the component any more). What stays
 * here is the other half of the honesty requirement, expressed as the shape of
 * the code that would break it: the shared sentence is a constant that uses the
 * agreed word and none of the banned ones, no card renderer or detail page may
 * bring `<ExampleNotice` back, and a card READS `isDemo` to withhold trust
 * (never to label).
 *
 * These are source assertions rather than a render, and that is deliberate: the
 * thing that has to hold is not what a component looks like once, it is that
 * the rule cannot be quietly undone.
 */

const SRC = join(process.cwd(), "src");

/**
 * A component's source with its prose taken out.
 *
 * EVERY ASSERTION IN THIS FILE IS MADE AGAINST THIS AND NOT AGAINST THE RAW
 * FILE, and the reason is the one that cost this platform a compliance record
 * elsewhere in the tree: a source assertion that reads comments is satisfied by
 * a comment. A check that a file contains a name passed on the doc block above
 * the code as readily as on the code, and a comment mentioning `<ExampleNotice`
 * would fail a `not.toMatch` about code that was clean.
 *
 * `withoutComments` keeps line numbers and does not mistake a URL or a regular
 * expression for a comment. It is the same reader the copy sweep uses.
 */
const read = (path: string) => withoutComments(readFileSync(join(SRC, path), "utf8"));

/** Every surface in the product that draws a property card. */
const CARD_RENDERERS = [
  "components/app/ListingCard.tsx",
  "components/app/search/MapDock.tsx",
] as const;

/*
 * Banned by `agent-identity.spec.mjs` and by `PRODUCT.md` section 7. "example"
 * is the agreed word.
 *
 * The list used to be typed out here, and in four other specs, and every one of
 * the five was a private copy that agreed with the others by luck. It is one
 * list now, in `lib/copy/banned-phrases`, widened with the schedule promises
 * that walked past all five. See F2-003.
 */
const BANNED = BANNED_IN_EXAMPLE_COPY;

describe("the example listing rules", () => {
  it("uses the agreed word and none of the banned ones", () => {
    expect(EXAMPLE_STATEMENT.toLowerCase()).toContain("example");
    expect(firstBannedPhrase(EXAMPLE_STATEMENT, BANNED)).toBeNull();
  });

  /*
   * D24 (the founder, 6 October) REVERSED THE RULE THIS BLOCK USED TO HOLD.
   *
   * It asserted that every card renderer SAYS something visible about an
   * example listing. The founder's ruling is that the visible "example"
   * labelling comes off the listing surfaces, and that the danger was never the
   * missing word but fabricated trust. So the rule is now the other half: a
   * card renderer still READS `isDemo`, and reads it to WITHHOLD trust (no
   * Verified mark, no rating on an example row), never to label. The notice
   * and the example badge may not appear on a card at all.
   */
  it.each(CARD_RENDERERS)("withholds trust on an example listing and labels nothing in %s", (path) => {
    const source = read(path);
    expect(source).toContain("isDemo");
    expect(source).not.toMatch(/<ExampleNotice\b/);
    expect(source).not.toContain("nf-badge--example");
    /* The Verified mark is gated on the row not being an example. */
    expect(source).toMatch(/verified\s*&&\s*!listing\.isDemo/);
  });

  /*
   * THE LANDING'S CARDS DO NOT SAY IT ANY MORE (D24). The landing's own card
   * (`ListingMini`) and its hands-on deck (`StackRoom`) left with the retired
   * landing rooms on 17 October; the mapper that feeds a site card still
   * carries the row's example flag so a card can withhold Verified on it.
   */
  it("keeps the example flag on the site card mapper", () => {
    const mapper = read("lib/site/listing-card.ts");
    expect(mapper).toMatch(/example:\s*listing\.isDemo\s*===\s*true/);
  });

  /*
   * The detail pages no longer say it either (D24). What they must do instead
   * is draw every trust signal through `earnedTrust`, the presentation-side
   * lock that clears badge, dates and rating on an example row.
   */
  it.each([
    "app/(app)/listing/[id]/page.tsx",
    "app/(app)/stay/[id]/StayDetailView.tsx",
    "app/(app)/restaurant/[id]/RestaurantFace.tsx",
    "components/app/listing/ListingMoveInBlock.tsx",
    "components/app/listing/ListingHandoffShell.tsx",
  ])("labels nothing as an example on %s", (path) => {
    const source = read(path);
    expect(source).not.toMatch(/<ExampleNotice\b/);
    expect(source).not.toContain("nf-badge--example");
    expect(source).not.toMatch(/tone="example"/);
  });

  it("draws the listing page's trust through earnedTrust", () => {
    const page = read("app/(app)/listing/[id]/page.tsx");
    expect(page).toContain("withEarnedTrust(");
    expect(page).toContain("earnedTrust(");
  });
});
