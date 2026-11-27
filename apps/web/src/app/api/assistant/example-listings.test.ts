import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNED_IN_EXAMPLE_COPY, firstBannedPhrase } from "@/lib/copy/banned-phrases";

/*
 * THE ASSISTANT IS A PUBLICATION SURFACE, AND IT WAS THE ONE NOBODY LISTED.
 *
 * The example-listing sweep sealed four places a property could escape to: the
 * sitemap, the JSON-LD, the Open Graph card and email. The assistant slipped
 * through all of it, because it is not a page and a chat reply does not look
 * like publishing. It is the most consequential of the five. The others display
 * a property and let a reader judge it. This one RECOMMENDS one, in a sentence,
 * with a naira price and a link, to somebody who asked for help finding a home.
 *
 * These tests are source constraints rather than behavioural tests, and that is
 * a deliberate limitation worth stating. The route cannot be imported here: it
 * needs an Anthropic key, a Supabase client and a streaming response, and the
 * vitest config aliases React at its server entry so nothing in the app tree
 * that touches JSX is importable anyway. Asserting on the source is weaker than
 * asserting on behaviour and it is far stronger than nothing, because the
 * failure this guards against is somebody deleting a filter, not the filter
 * behaving oddly.
 */

/*
 * The search and compare runners moved out of `route.ts` into one file per
 * tool (AI-01, `lib/assistant/tools/`). The constraints below follow the code
 * there, unchanged; `ROUTE` is the two tool files read as one source.
 */
const ROUTE = ["search-listings.ts", "compare-listings.ts"]
  .map((file) => readFileSync(join(process.cwd(), "src/lib/assistant/tools", file), "utf8"))
  .join("\n");
const WIRE = readFileSync(
  join(process.cwd(), "src/lib/assistant/types.ts"),
  "utf8",
);

describe("the result card carries only what the row states", () => {
  /*
   * The governing render shows a Verified mark and a beds, baths and floor
   * area row on every card in the thread. The card may draw them only from
   * the wire, and the wire may carry them only from the repository row, so
   * this pins both ends: the type declares the four facts and the search
   * mapper reads each one off `l`, the real listing, never a literal.
   */
  it("declares the facts on the wire type", () => {
    expect(WIRE).toMatch(/verified: boolean;/);
    expect(WIRE).toMatch(/bedrooms\?: number;/);
    expect(WIRE).toMatch(/bathrooms\?: number;/);
    expect(WIRE).toMatch(/sizeSqm\?: number;/);
  });

  it("reads each fact off the listing row in the search mapper", () => {
    const mapper = /const forModel = top\.map\(\(l\) => \(\{[\s\S]*?\}\)\);/.exec(ROUTE)?.[0] ?? "";
    expect(mapper.length).toBeGreaterThan(0);
    expect(mapper).toContain("verified: l.verified");
    expect(mapper).toMatch(/l\.bedrooms > 0 \? \{ bedrooms: l\.bedrooms \}/);
    expect(mapper).toMatch(/l\.bathrooms > 0 \? \{ bathrooms: l\.bathrooms \}/);
    expect(mapper).toMatch(/l\.sizeSqm > 0 \? \{ sizeSqm: l\.sizeSqm \}/);
    // Never a literal true: the mark means a human was checked, or nothing.
    expect(mapper).not.toMatch(/verified: true/);
  });
});

describe("the assistant finds the examples and says what they are", () => {
  /*
   * THE RULE REVERSED ON 26 NOVEMBER 2026, and the half that mattered stayed.
   *
   * This block used to require `excludeDemo` on every catalogue search but
   * one, so the model never saw an example listing at all. That was right
   * while the examples were the whole catalogue and the risk was a
   * recommendation nobody could act on. The founder's instruction, in the
   * brief that put a hundred examples back: the assistant finds them the same
   * way VALLO Intelligence does, and always says they are examples, never
   * available to rent.
   *
   * So the exclusion is gone and the fence replaces it. What is pinned now is
   * the pair that makes that honest: every example row is FLAGGED, and every
   * reply carrying one also carries the instruction saying what an example is
   * and what it cannot do. A regression that drops the flag or the note while
   * keeping the rows is the dangerous shape, because it puts a naira price and
   * a link on a property that does not exist with nothing marking it.
   *
   * These are source constraints for the reason the header gives: the route
   * cannot be imported here. Weaker than behaviour, far stronger than nothing,
   * because the failure guarded against is somebody deleting the flag.
   */
  it("no longer hides the examples from the catalogue search", () => {
    /*
     * Counted, not merely absent. Both search calls are checked, the narrow
     * one and the widened fallback, because an exclusion left on either would
     * put the assistant back to answering "I found nothing" to a question the
     * search page beside it answers with rows.
     */
    const searches = ROUTE.match(/repo\.search\(\{[^}]*\}/g) ?? [];
    expect(searches.length).toBeGreaterThanOrEqual(2);
    expect(searches.filter((call) => call.includes("excludeDemo"))).toHaveLength(0);
  });

  it("flags every example row, in both tools", () => {
    /* The flag is the whole mechanism now. Both mappers read it off the row
       and neither writes a literal. */
    const flags = ROUTE.match(/l\.isDemo \? \{ example: true \}/g) ?? [];
    expect(flags).toHaveLength(2);
    expect(ROUTE).not.toMatch(/example: false/);
  });

  it("never lets an example outrank a real listing", () => {
    /* An example carries no reviews, so on rating alone it would sort below
       anything real anyway. Stated as the first sort key so that stays true
       if one ever gains a rating. */
    expect(ROUTE).toMatch(/Number\(a\.isDemo\) - Number\(b\.isDemo\)/);
  });

  it("sends the instruction with any reply that carries one", () => {
    /* Both tools, both gated on a row actually being an example, because a
       note on every reply trains the model to skim past it. */
    const notes = ROUTE.match(/note: EXAMPLE_NOTE/g) ?? [];
    expect(notes).toHaveLength(2);
    expect(ROUTE).toMatch(/hasExample\s*\n?\s*\?/);
    expect(ROUTE).toMatch(/some\(\(row\) => row\.example === true\)/);
  });

  it("tells the model what an example cannot do, in the note itself", () => {
    /* The note itself contains escaped quotes (it quotes the "example" key),
       so the literal is matched allowing for them rather than stopping at the
       first one. */
    const note = /export const EXAMPLE_NOTE =\s*"(?:[^"\\]|\\.)*"/.exec(ROUTE)?.[0] ?? "";
    expect(note.length).toBeGreaterThan(0);
    expect(note).toMatch(/example/i);
    expect(note).toMatch(/cannot be rented, booked, inspected or paid for/);
    expect(note).toMatch(/[Nn]ever present one as available/);
    /* It may be named and priced, because the person can see both on the
       listing itself; what it may not be is passed off as real. */
    expect(note).toMatch(/what you may not do is let them think it is real/);
  });

  it("keeps the banned words out of anything a reader could see", () => {
    /* `agent-identity.spec.mjs` bans these in user-facing copy. "example" is
       the agreed word and the note uses it. */
    const note = /export const EXAMPLE_NOTE =\s*"(?:[^"\\]|\\.)*"/.exec(ROUTE)?.[0] ?? "";
    expect(note.length).toBeGreaterThan(0);
    expect(firstBannedPhrase(note, BANNED_IN_EXAMPLE_COPY)).toBeNull();
  });

  /*
   * WHAT THE EXCLUSION USED TO PROTECT, STILL PROTECTED, SOMEWHERE ELSE.
   *
   * Showing an example to somebody who asked what is available is honest once
   * it is labelled. PUSHING one at somebody who did not ask is not, and
   * neither is putting one in something that leaves the app. Those surfaces
   * keep their filter and this is the assertion that says so, so that
   * "examples are allowed now" cannot spread from search to everything.
   */
  it("still keeps examples out of what is pushed or published", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");
    /* Suggested from a member's own saves, unasked: a recommendation. */
    expect(read("lib/assistant/tools/saved.ts")).toMatch(/excludeDemo:\s*true/);
    /* Saved-search alerts: a push notification about a place that does not exist. */
    expect(read("lib/saved/search-alerts.ts")).toMatch(/excludeDemo = true/);
    /* The sitemap, the structured data and the Open Graph card. */
    expect(read("lib/listings/syndication.ts")).toMatch(/excludeDemo:\s*true/);
  });
});
